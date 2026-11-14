require('dotenv').config({ path: __dirname + '/../.env' });
const nodemailer = require('nodemailer');

async function verifySmtp() {
  const host = process.env.EMAIL_HOST || 'smtp.gmail.com';
  const port = parseInt(process.env.EMAIL_PORT, 10) || 587;
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASSWORD;

  console.log('Testing SMTP configuration:');
  console.log('Host:', host);
  console.log('Port:', port);
  console.log('User:', user ? user.replace(/(.{2})(.*)(@.*)/, '$1***$3') : '(none)');
  console.log('Password length:', pass ? pass.length : 0);

  if (!user || !pass) {
    console.error('ERROR: EMAIL_USER or EMAIL_PASSWORD is not set in server/.env');
    process.exit(1);
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  try {
    await transporter.verify();
    console.log('SUCCESS: SMTP connection verified successfully!');
    process.exit(0);
  } catch (err) {
    console.error('FAILURE: SMTP verification failed:');
    console.error('Code:', err.code);
    console.error('Response Code:', err.responseCode);
    console.error('Message:', err.message);
    process.exit(1);
  }
}

verifySmtp();
