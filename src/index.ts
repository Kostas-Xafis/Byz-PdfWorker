import fontkit from "@pdf-lib/fontkit";
import { PDFDocument } from "pdf-lib";
import { EndpointResponse, PDFRegstration, PDFRequest, TemplateCoords } from "./types";

const { SITE_URL, IS_DEV, PORT } = Bun.env;

const corsHeaders = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Methods": "GET, POST, OPTIONS",
	"Access-Control-Allow-Headers": "*",
};
function handleOptions(request: Request) {
	if (request.headers.get("Origin") !== null &&
		request.headers.get("Access-Control-Request-Method") !== null &&
		request.headers.get("Access-Control-Request-Headers") !== null) {
		// Handle CORS pre-flight request
		return new Response(null, { headers: corsHeaders });
	} else {
		// Handle standard OPTIONS request
		return new Response(null, { headers: { "Allow": "GET, HEAD, POST, OPTIONS" } });
	}
}

Bun.serve({
	port: PORT || 3000,
	async fetch(req: Request): Promise<Response> {
		if (SITE_URL === null || SITE_URL === undefined ||
			IS_DEV === null || IS_DEV === undefined
		) return new Response("Internall service error", { status: 500 });
		if (req.method === "OPTIONS")
			return handleOptions(req);
		if (req.method !== "POST")
			return new Response("Invalid request. This service accepts only POST requests", { status: 400 });

		if (!IS_DEV) {
			const { hostname } = new URL(req.headers.get("referer") || "");
			if (hostname !== "musicschool-metamorfosi.gr" && hostname !== "byzantini-website.pages.dev")
				return new Response("Invalid request from: " + req.headers, { status: 401, headers: corsHeaders });

			//Authenticate the request
			const isAuthenticated = await authenticateUser(req);
			if (isAuthenticated !== true)
				return new Response("Invalid credentials: " + isAuthenticated, { status: 401, headers: corsHeaders });
		}

		const body = await req.json() as PDFRequest;
		if (!body) return new Response("Malformed request, please check the request body.", { status: 400 });

		const requestType = body.type;
		try {
			if (requestType === "registration") {
				return handleRegistrationPDFRequest(body);
			} else {
				return new Response("Invalid request type. This service accepts only 'registration' requests", { status: 400 });
			}
		} catch (e) {
			return new Response("Malformed request, please check the request body.", { status: 400 });
		}
	},
});


async function handleRegistrationPDFRequest(body: PDFRequest): Promise<Response> {
	const req = body.request;
	if (req.isMultiple) {
		const pdfs = await Promise.all(req.data.map(async registration => {
			const pdf = new PDF();
			await pdf.fillTemplate(registration);
			return pdf;
		}));
		const mergedBlob = await new PDF().mergePDFs(pdfs);
		return new Response(mergedBlob, { headers: { ...corsHeaders, "Content-Type": "application/pdf" } });
	} else {
		const pdf = new PDF();
		await pdf.fillTemplate(req.data);
		return new Response(await pdf.getBlob(), {
			headers: {
				...corsHeaders,
				"Content-Type": "application/pdf",
				"Access-Control-Allow-Origin": "*",
			}
		});
	}
}

export class PDF {
	private doc = {} as typeof PDFDocument.prototype;
	constructor() { };

	public async fillTemplate(reg: PDFRegstration): Promise<void> {
		this.doc = await PDFDocument.load(await PDF.getBuffer(reg.url));

		const p = this.doc.getPages()[0];
		const c = TemplateCoords;

		this.doc.registerFontkit(fontkit);
		const font = await this.doc.embedFont(await PDF.getFont());

		const fontSize = 14;
		const smFontSize = 12;
		const xsFontSize = 11;
		let s = reg.student;
		p.drawText("" + s.am, { x: c.am.x, y: c.am.y, size: fontSize, font });
		p.drawText("" + s.last_name, { x: c.lastName.x, y: c.lastName.y, size: fontSize, font });
		p.drawText("" + s.first_name, { x: c.firstName.x, y: c.firstName.y, size: fontSize, font });
		p.drawText("" + s.fathers_name, { x: c.fathersName.x, y: c.fathersName.y, size: fontSize, font });
		p.drawText("" + s.road, { x: c.road.x, y: c.road.y, size: fontSize, font });
		p.drawText("" + s.number, { x: c.number.x, y: c.number.y, size: fontSize, font });
		p.drawText("" + s.tk, { x: c.tk.x, y: c.tk.y, size: fontSize, font });
		p.drawText("" + s.region, { x: c.region.x, y: c.region.y, size: fontSize, font });
		p.drawText("" + (new Date(s.birth_date)).getFullYear(), { x: c.birthDate.x, y: c.birthDate.y, size: fontSize, font });
		p.drawText("" + s.telephone, { x: c.telephone.x, y: c.telephone.y, size: fontSize, font });
		p.drawText("" + s.cellphone, { x: c.cellphone.x, y: c.cellphone.y, size: fontSize, font });
		p.drawText("" + s.email, { x: c.email.x, y: c.email.y, size: fontSize, font });
		p.drawText("" + s.registration_year, { x: c.registrationYear.x, y: c.registrationYear.y, size: fontSize, font });
		p.drawText("" + s.class_year, { x: c.classYear.x, y: c.classYear.y, size: fontSize, font });
		if (reg.teachersName) {
			p.drawText("" + reg.teachersName, { x: c.teachersName.x, y: c.teachersName.y, size: reg.teachersName.length <= 24 ? fontSize : (reg.teachersName.length <= 30 ? smFontSize : xsFontSize), font });
		} else {
			p.drawText("-", { x: c.teachersName.x, y: c.teachersName.y, size: fontSize, font });
		}

		const date = new Date(s.date);
		let month = (date.getMonth() + 1) + "";
		month = month.length === 1 ? "0" + month : month;

		let day = date.getDate() + "";
		day = day.length === 1 ? "0" + day : day;

		let year = (date.getFullYear() % 100) + "";
		year = year.length === 1 ? "0" + year : year;

		p.drawText(day, { x: c.dateDD.x, y: c.dateDD.y, size: fontSize, font });
		p.drawText(month, { x: c.dateMM.x, y: c.dateMM.y, size: fontSize, font });
		p.drawText(year, { x: c.dateYYYY.x, y: c.dateYYYY.y, size: fontSize, font });

		p.drawText("24", { x: c.year1.x, y: c.year1.y, size: fontSize, font });
		p.drawText("25", { x: c.year2.x, y: c.year2.y, size: fontSize, font });

		if (reg?.instrument && reg?.instrument.length > 15) {
			p.drawText(reg.instrument, { x: c.instrumentLarge.x, y: c.instrumentLarge.y, size: fontSize, font });
		} else if (reg.instrument) {
			if (reg.student.class_id === 1) p.drawText(reg.instrument, { x: c.instrumentPar.x, y: c.instrumentPar.y, size: fontSize, font });
			else if (reg.student.class_id === 2) p.drawText(reg.instrument, { x: c.instrumentEur.x, y: c.instrumentEur.y, size: fontSize, font });
		}
	}

	public getBlob(): Promise<Uint8Array> {
		return this.doc.save();
	}

	public async mergePDFs(pdfFiles: PDF[]): Promise<Uint8Array> {
		// Create a new PDFDocument for the output
		this.doc = await PDFDocument.create();

		for (const pdfFile of pdfFiles) {
			// Load each PDF file
			const pdfBytes = await pdfFile.getBlob();
			const pdfDoc = await PDFDocument.load(pdfBytes);

			// Copy pages from the current PDF document to the merged document
			const pages = await this.doc.copyPages(pdfDoc, pdfDoc.getPageIndices());
			pages.forEach((page) => {
				this.doc.addPage(page);
			});
		}

		// Serialize the merged PDF to bytes
		return await this.doc.save();
	}

	private static Font: ArrayBuffer | null = null;
	private static TemplateCache: Record<string, ArrayBuffer> = {};

	private static async getFont(): Promise<ArrayBuffer> {
		if (!PDF.Font) {
			PDF.Font = await DidactGothicFontBuffer();
		}
		return PDF.Font;
	}

	private static async getBuffer(url: string): Promise<ArrayBuffer> {
		if (!PDF.TemplateCache[url]) {
			PDF.TemplateCache[url] = await (await fetch(SITE_URL + url)).arrayBuffer();
		}
		return PDF.TemplateCache[url];
	}
}

const pdfHeight = 841.89;
const H = (y: number) => pdfHeight - y;
const TemplateCoords: TemplateCoords = {
	am: { x: 140, y: 260 },
	lastName: { x: 105, y: 285 },
	firstName: { x: 85, y: 310 },
	fathersName: { x: 130, y: 335 },
	birthDate: { x: 130, y: 361 },
	road: { x: 75, y: 412 },
	number: { x: 112.5, y: 438 },
	tk: { x: 200, y: 438 },
	region: { x: 148, y: 463 },
	telephone: { x: 128, y: 490 },
	cellphone: { x: 115, y: 515 },
	email: { x: 80, y: 540 },
	registrationYear: { x: 110, y: 566 },
	classYear: { x: 135, y: 591 },
	teachersName: { x: 115, y: 619 },
	dateDD: { x: 164, y: 736 },
	dateMM: { x: 193, y: 736 },
	dateYYYY: { x: 237, y: 736 },
	year1: { x: 418, y: 436 },
	year2: { x: 480, y: 436 },
	instrumentPar: { x: 475, y: 488 },
	instrumentEur: { x: 420, y: 489 },
	instrumentLarge: { x: 325, y: 513 },
	signatureByz: { x: 360, y: 622 },
	signatureEur: { x: 360, y: 662 },
};
Object.values(TemplateCoords).forEach(v => v.y = H(v.y));

const DidactGothicFontBuffer = async () => {
	return await (await fetch(SITE_URL + "/fonts/DidactGothic-Regular.ttf")).arrayBuffer();
};

const authenticateUser = async (req: Request) => {
	const authHeader = req.headers.get("Authorization");
	if (!authHeader || !authHeader.startsWith("Bearer ")) return "No Authorization header provided";

	const token = authHeader.split("Bearer ")[1].trim();
	if (!token) return "No token provided";

	try {
		const res = await fetch(SITE_URL + "/api/auth/session", {
			method: "POST",
			headers: {
				"Cookie": `session_id=${token}`
			}
		});
		const data = await res.json() as EndpointResponse<{ isValid: boolean; }>;
		return data.res?.data?.isValid || false;
	} catch (e) {
		return "Could not connect to the authentication server";
	}
};
