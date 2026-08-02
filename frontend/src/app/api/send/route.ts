import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function POST(request: Request) {
  try {
    const { gmail_email, gmail_app_password, subject, body, to } = await request.json();

    if (!gmail_email || !gmail_app_password || !subject || !body || !to) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Clean credentials just like the python backend did
    const clean_email = gmail_email.trim();
    const clean_password = gmail_app_password.replace(/\xa0/g, '').replace(/ /g, '').trim();

    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465, // Use SSL as default since 587 is sometimes blocked
      secure: true, 
      auth: {
        user: clean_email,
        pass: clean_password,
      },
      connectionTimeout: 10000,
    });

    await transporter.sendMail({
      from: clean_email,
      to,
      subject,
      text: body,
    });

    return NextResponse.json({ email: to, status: 'success' });
  } catch (error: any) {
    console.error(`Failed to send email: ${error.message}`);
    return NextResponse.json(
      { email: 'unknown', status: 'failed', error: error.message },
      { status: 500 }
    );
  }
}
