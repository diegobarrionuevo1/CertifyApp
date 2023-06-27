import { Persona } from "./sharp";

interface FetchEnvialoParams {
  url: string;
  method: "GET" | "POST" | "PUT" | "DELETE";
  body?: object;
  which: string;
}

interface FetchResponse {
  ok: boolean;
  status: number;
  message: string;
  json: any;
}

const fetchEnvialo = async ({
  url,
  method,
  body = {},
  which,
}: FetchEnvialoParams): Promise<FetchResponse> => {
  const API_KEY = process.env.API_KEY;
  if (!API_KEY) {
    throw new Error("API_KEY is not defined");
  }

  const requestOptions: RequestInit = {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
    },
    body: method !== "GET" ? JSON.stringify(body) : undefined,
  };

  const response = await fetch(url, requestOptions);
  const json = await response.json();

  if (!response.ok) {
    throw new Error(
      `Request failed with status ${response.status} IN ACQUISITION OF ${which}`
    );
  }
  
  return {
    ok: response.ok,
    status: response.status,
    message: response.statusText,
    json,
  };
};

interface DataModelada {
  tituloCurso: string;
  dataRegistrados: Persona[];
}

interface RequesDataEmails {
  from: string;
  to: string;
  templateID: string;
  subject: string;
  substitutions: {
    apellido: string;
    estado_asistencia: string;
    id_registrado: number;
    titulo_curso: string;
    nombre: string;
    urlFront: string;
  };
}

const MAX_RETRIES = 3;
let emailsFailes: Set<string> = new Set();

const enviar = async (
  urlEnvialo: string,
  requestData: RequesDataEmails,
  retryCount: number = 0,
  email: string
): Promise<void> => {
  try {
    await fetchEnvialo({ url: urlEnvialo, method: "POST", body: requestData, which: "envialo simple" });
  } catch (e) {
    if (e instanceof Error) {
      console.error(`Error when sending email: ${e.message}`);
    } else {
      console.error(`An unexpected error occurred: ${e}`);
    }

    if (retryCount < MAX_RETRIES) {
      console.log(`Retry attempt ${retryCount + 1} for ${email}`);
      await enviar(urlEnvialo, requestData, retryCount + 1, email);
    } else {
      emailsFailes.add(email);
      console.error(
        `Failed to send email to ${email} after ${MAX_RETRIES} retries`
      );
    }
  }
};


export const sendEmail = async (emailData: DataModelada): Promise<void> => {
  const SMTP_EMAIL = process.env.SMTP_EMAIL;
  const SMTP_URL = process.env.SMTP_URL;

  if (!SMTP_URL || !SMTP_EMAIL) {
    throw new Error(`Env SMTP_URL  || SMTP_EMAIL is not defined`);
  };

  await Promise.all(
    emailData.dataRegistrados.map(async (result) => {
      const requestData: RequesDataEmails = {
        from: SMTP_EMAIL,
        to: result.correo,
        templateID: "643851c86fe769a160054def",
        subject: "Felicitaciones por completar el taller",
        substitutions: {
          apellido: result.apellido,
          estado_asistencia: result.estado_asistencia,
          id_registrado: result.id_registrado,
          titulo_curso: emailData.tituloCurso,
          nombre: result.nombre,
          urlFront: result.url_Front,
        },
      };
      await enviar(SMTP_URL, requestData, 0, result.correo);
    })
  );
};

/* app.post("/send-emails", async (req, res) => {
  try {
    const { usuarios: users } = req.body
    if (users?.length === 0) {
      return res.status(400).json({ error: "No users provided" })
    }

    const sendEmails = users?.map((user) => sendEmail(user))

    await Promise.all(sendEmails)
    res.json({ success: true })
  } catch (error) {
    console.error("Error sending emails:", error)
    return res
      .status(500)
      .json({ error: "An error occurred while sending emails" })
  }
})
 */
