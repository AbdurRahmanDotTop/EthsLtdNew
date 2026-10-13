const apiKey = process.env.BREVO_API_KEY || "";

async function testBrevo() {
  const accountRes = await fetch("https://api.brevo.com/v3/account", {
    headers: {
      accept: "application/json",
      "api-key": apiKey.trim(),
    },
  });

  const text = await accountRes.text();
  console.log("Raw Response:", accountRes.status, text);

  // Also test sending a test email to check what Brevo says
  const emailRes = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      accept: "application/json",
      "api-key": apiKey.trim(),
      "content-type": "application/json",
    },
    body: JSON.stringify({
      sender: { name: "ETHSLTD", email: "support@ethsltd.com" },
      to: [{ email: "test@example.com" }],
      subject: "Test Brevo Connection",
      htmlContent: "<p>Test</p>",
    }),
  });
  const emailText = await emailRes.text();
  console.log("Email Raw Response:", emailRes.status, emailText);
}

testBrevo();
