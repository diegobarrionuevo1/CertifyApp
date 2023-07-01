import { Persona } from "./sharp";

const MAX_RETRIES: number = 3;

async function sendEmail(emailData: Persona, retryCount: number = 0, API_KEY:string|undefined , titulo_curso:string, fecha_inicio:string) {
  const requestData = {
    from: "info@certificados.donweb.com",
    to: emailData.correo,
    templateID: "643851c86fe769a160054def",
    subject: `Felicitaciones por completar el taller ${titulo_curso}`,
    substitutions: {
      nombre: emailData.nombre,
      apellido: emailData.apellido,
      id_curso: String(emailData.id_curso),
      correo:emailData.correo,
      titulo_curso: titulo_curso,
      fecha_taller: fecha_inicio

    },
  };

  try {
    const response = await fetch("https://api.envialosimple.email/api/v1/mail/send", {
      method: 'POST',
      body: JSON.stringify(requestData),
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${API_KEY}`,
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
  } catch (e) {
    console.log("Error when sending email: ", e);
    if (retryCount < MAX_RETRIES) {
      console.log(`Retry attempt ${retryCount + 1} for ${emailData.correo}`);
      await sendEmail(emailData, retryCount + 1,API_KEY,titulo_curso, fecha_inicio);
    } else {
      console.log(
        `Failed to send email to ${emailData.correo} after ${MAX_RETRIES} retries`
      );
    }
  }
};

export async function funcionParaEnviarEmail(usuarios: Persona[],titulo_curso:string, fecha_inicio:string, API_KEY:string|undefined) {
  try {
    const sendEmails = usuarios?.map((usuario) => sendEmail(usuario, 0 , API_KEY, titulo_curso, fecha_inicio));
    await Promise.all(sendEmails);
  } catch (error) {
    console.error("Error sending emails:", error);
  }
}