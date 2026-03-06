const fs = require("fs");
const path = require("path");
const { Resend } = require("resend");
const ejs = require("ejs");

const resend = new Resend(process.env.RESEND_API_KEY);

// Validate required environment variables
if (!process.env.RESEND_API_KEY) {
    console.warn('WARNING: RESEND_API_KEY is not configured. Email sending will fail.');
}
if (!process.env.EMAIL_FROM) {
    console.warn('WARNING: EMAIL_FROM is not configured. Email sending will fail.');
}

const injectData = (html, data) => {
  let updatedHtml = html;

  for (const key in data) {
    const regex = new RegExp(`{{${key}}}`, "g");
    updatedHtml = updatedHtml.replace(regex, data[key]);
  }

  return updatedHtml;
};


const sendEmail = async ({ to, subject, template, data = {} }) => {
  try {

    console.log('tememeap', template)
    const templatePath = path.join(
      process.cwd(),
      "emails",         
      `${template}.ejs`
    );

    if (!fs.existsSync(templatePath)) {
      throw new Error(`Email template not found: ${template}`);
    }

    const html = await ejs.renderFile(templatePath, data);

    const response = await resend.emails.send({
      from: process.env.EMAIL_FROM,
      to,
      subject,
      html,
    });

    // console.log("RESEND RESPONSE:", response);

    return response;

  } catch (error) {
    console.error("EMAIL ERROR:", error);
    throw error;
  }
};

module.exports = sendEmail;
