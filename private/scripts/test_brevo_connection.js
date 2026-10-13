const apiKey = process.env.BREVO_API_KEY || "";

async function testBrevo() {
  console.log("Testing Brevo API connection...");

  // 1. Check Account
  const accountRes = await fetch("https://api.brevo.com/v3/account", {
    headers: {
      accept: "application/json",
      "api-key": apiKey,
    },
  });

  console.log(`Account status: ${accountRes.status} ${accountRes.statusText}`);
  const accountData = await accountRes.json();
  console.log("Account info:", JSON.stringify({
    email: accountData.email,
    firstName: accountData.firstName,
    lastName: accountData.lastName,
    companyName: accountData.companyName,
    plan: accountData.plan?.map(p => ({ type: p.type, credits: p.credits })),
  }, null, 2));

  // 2. Check Senders
  const sendersRes = await fetch("https://api.brevo.com/v3/senders", {
    headers: {
      accept: "application/json",
      "api-key": apiKey,
    },
  });

  console.log(`Senders status: ${sendersRes.status} ${sendersRes.statusText}`);
  const sendersData = await sendersRes.json();
  console.log("Verified senders:", JSON.stringify(sendersData.senders?.map(s => ({
    id: s.id,
    name: s.name,
    email: s.email,
    active: s.active,
  })), null, 2));
}

testBrevo().catch(console.error);
