import { createServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type SignupRequest = {
  email?: unknown;
  password?: unknown;
  name?: unknown;
  phone?: unknown;
  phoneCountry?: unknown;
};

type ProfileUpdateClient = {
  from: (table: "profiles") => {
    update: (values: { name: string; email: string; phone: string }) => {
      eq: (column: "id", value: string) => Promise<unknown>;
    };
  };
};

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function signupErrorMessage(message: string) {
  const normalized = message.toLowerCase();
  if (
    normalized.includes("already registered") ||
    normalized.includes("already been registered") ||
    normalized.includes("already exists")
  ) {
    return "Пользователь с таким email уже существует";
  }
  return message;
}

export async function POST(request: Request) {
  let body: SignupRequest;

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_json", message: "Некорректный запрос" }, { status: 400 });
  }

  const email = cleanString(body.email).toLowerCase();
  const password = cleanString(body.password);
  const name = cleanString(body.name);
  const phone = cleanString(body.phone);
  const phoneCountry = cleanString(body.phoneCountry);

  if (!email || !password || !name || !phone || !phoneCountry) {
    return Response.json({ error: "missing_fields", message: "Заполните все поля" }, { status: 400 });
  }

  if (password.length < 8) {
    return Response.json(
      { error: "weak_password", message: "Пароль должен быть не менее 8 символов" },
      { status: 400 }
    );
  }

  if (!process.env.SUPABASE_SERVICE_KEY) {
    return Response.json(
      { error: "server_misconfigured", message: "Регистрация временно недоступна" },
      { status: 500 }
    );
  }

  const service = createServiceClient();
  const { data, error } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      name,
      phone,
      phone_country: phoneCountry,
    },
  });

  if (error) {
    const message = signupErrorMessage(error.message);
    return Response.json(
      { error: "signup_failed", message },
      { status: message.includes("уже существует") ? 409 : 400 }
    );
  }

  const userId = data.user?.id;
  if (userId) {
    await (service as unknown as ProfileUpdateClient)
      .from("profiles")
      .update({ name, email, phone })
      .eq("id", userId);
  }

  return Response.json({ userId });
}
