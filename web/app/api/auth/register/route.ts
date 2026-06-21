import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { createUser, getUserByEmail } from "@/lib/db";
import { sendWelcomeEmail, sendAdminNewSignupEmail } from "@/lib/email";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  let body: { name?: string; email?: string; password?: string; organization?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const name         = (body.name ?? "").trim();
  const email        = (body.email ?? "").trim().toLowerCase();
  const password     = body.password ?? "";
  const organization = (body.organization ?? "").trim();

  if (!name || name.length > 255) {
    return NextResponse.json(
      { error: "invalid_name", message: "Enter your name." },
      { status: 400 }
    );
  }
  if (!EMAIL_RE.test(email) || email.length > 255) {
    return NextResponse.json(
      { error: "invalid_email", message: "Enter a valid email address." },
      { status: 400 }
    );
  }
  if (!organization || organization.length > 255) {
    return NextResponse.json(
      { error: "invalid_org", message: "Enter your organization name." },
      { status: 400 }
    );
  }
  if (password.length < 8) {
    return NextResponse.json(
      {
        error: "weak_password",
        message: "Password must be at least 8 characters.",
      },
      { status: 400 }
    );
  }
  if (password.length > 200) {
    return NextResponse.json(
      { error: "invalid_password", message: "Password is too long." },
      { status: 400 }
    );
  }

  const existing = await getUserByEmail(email);
  if (existing) {
    return NextResponse.json(
      {
        error: "email_taken",
        message: "An account with this email already exists. Sign in instead.",
      },
      { status: 409 }
    );
  }

  const passwordHash = await bcrypt.hash(password, 12);

  try {
    const user = await createUser({ email, passwordHash, name });

    // Fire emails non-blocking — never fail registration over an email error
    Promise.all([
      sendWelcomeEmail({ to: email, name, organization }).catch(err =>
        console.error("[register] welcome email failed:", err.message)
      ),
      sendAdminNewSignupEmail({ userName: name, userEmail: email, organization, userId: user.id }).catch(err =>
        console.error("[register] admin notification failed:", err.message)
      ),
    ]);

    return NextResponse.json(
      { ok: true, userId: user.id },
      { status: 201 }
    );
  } catch (err: unknown) {
    // Unique-constraint race: a parallel request created the same email.
    const message = err instanceof Error ? err.message : "";
    if (message.includes("duplicate key")) {
      return NextResponse.json(
        {
          error: "email_taken",
          message:
            "An account with this email already exists. Sign in instead.",
        },
        { status: 409 }
      );
    }
    console.error("Registration failed:", err);
    return NextResponse.json(
      { error: "server_error", message: "Could not create account." },
      { status: 500 }
    );
  }
}
