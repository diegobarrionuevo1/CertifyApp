import sharp from "sharp";
import fs from "fs";
import PDFDocument from "pdfkit";
export interface Persona {
  apellido: string;
  correo: string;
  date_created: string;
  date_updated: string | null;
  estado_asistencia: string;
  id_registrado: number;
  id_webinar: number;
  nombre: string;
  pais: string;
  pais_id: number | null;
  url_front?: string;
  id_curso?:string
}

export async function superponerTextoEnImagen(
  id_curso: number,
  imagenPlantilla: Buffer,
  personas: Persona[]
) {
  // Cargar la imagen plantilla
  const imagenOriginal = sharp(imagenPlantilla);
  const metadata = await imagenOriginal.metadata();

  // Crear una nueva capa para el texto
  const capaTextoBase = (nombre: string, apellido: string) => {
    return Buffer.from(
      `<svg>
      <text x="-2" y="30" font-size="45" fill="black">  ${nombre} ${apellido}  </text>
    </svg>`
    );
  };

  // Procesar cada persona y generar una imagen superpuesta
  for (const persona of personas) {
    const { nombre, apellido, correo } = persona;
    // Crear el documento PDF
    let pdf = new PDFDocument({
      size: [1123, 794],
      margins: { top: 1, left: 1, bottom: 1, right: 1 },
    });

    const capaTexto = capaTextoBase(nombre, apellido);
    // Superponer la capa de texto en la imagen original
    const imagenSuperpuesta = await imagenOriginal
      .clone()
      .composite([{ input: capaTexto }])
      .toBuffer();

    const copiaImagenSuperpuesta = Buffer.from(imagenSuperpuesta);

    // Guardar la imagen superpuesta en un archivo
    const nombreArchivo = `${id_curso}_${correo.toLowerCase()}.jpg`;
    const rutaImagenSalida = `files/jpg/${id_curso}/${nombreArchivo}`;

    // Verificar si el directorio de destino existe, si no, crearlo
    if (!fs.existsSync(`files/jpg/${id_curso}`)) {
      fs.mkdirSync(`files/jpg/${id_curso}`);
    }

    fs.writeFileSync(rutaImagenSalida, imagenSuperpuesta);
    // Agregar la imagen al documento PDF
    pdf.image(rutaImagenSalida, {
      fit: [pdf.page.width, pdf.page.height], // Ajustar al tamaño de la página
      align: "right",
      valign: "center",
    });

    // Guardar el documento PDF
    const nombrePDF = `${id_curso}_${correo.toLowerCase()}.pdf`;
    const rutaPDF = `files/pdf/${id_curso}/${nombrePDF}`;

    // Verificar si el directorio de destino existe, si no, crearlo
    if (!fs.existsSync(`files/pdf/${id_curso}`)) {
      fs.mkdirSync(`files/pdf/${id_curso}`);
    }

    pdf.pipe(fs.createWriteStream(rutaPDF));
    pdf.end();

    const imagenFondoTransparente = Buffer.from(
      `<svg width="1200" height="627" xmlns="http://www.w3.org/2000/svg"></svg>`
    );
    const imagenPrincipal = sharp(rutaImagenSalida);
    //Email----------------------------------------------------------------------------
    const imagenEmail = await imagenPrincipal
      .clone()
      .resize(600, null)
      .toBuffer();
    const rutaImagenEmail = `files/email/${id_curso}/${nombreArchivo}`;

    // Verificar si el directorio de destino existe, si no, crearlo
    if (!fs.existsSync(`files/email/${id_curso}`)) {
      fs.mkdirSync(`files/email/${id_curso}`);
    }
    fs.writeFileSync(rutaImagenEmail, imagenEmail);

    // LinkedIn-------------------------------------------------------------------------

    const imagenPrincipalRedimensionada = await imagenPrincipal
      .clone()
      .resize(null, 627)
      .toBuffer();
    const imagenRrss = await sharp(imagenFondoTransparente)
      .composite([
        {
          input: imagenPrincipalRedimensionada,
          top: 0,
          left: 157,
        },
      ])
      .toBuffer();

    // Guardar la imagen superpuesta en un archivo
    const rutaImagenRrss = `files/rrss/${id_curso}/${nombreArchivo}`;

    // Verificar si el directorio de destino existe, si no, crearlo
    if (!fs.existsSync(`files/rrss/${id_curso}`)) {
      fs.mkdirSync(`files/rrss/${id_curso}`);
    }

    fs.writeFileSync(rutaImagenRrss, imagenRrss);
  }
}
