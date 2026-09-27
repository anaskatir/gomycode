import { extractionSchema } from "../lib/schema";

const validJson = {
  transcript: "Karim khda tlata kilo dial sokkar, khallas mia w baqi lih miatayn",
  intent: "sale",
  customer_name: "Karim",
  items: [
    {
      product: "sokkar",
      quantity: 3,
      unit: "kilo",
      price: null
    }
  ],
  amount_total: 300,
  amount_paid: 100,
  amount_credit: 200,
  confidence: 0.95,
  uncertainties: []
};

const invalidJson = {
  transcript: "invalid",
  intent: "hello", // invalid intent
  customer_name: "Karim",
  items: [
    {
      product: "sokkar"
    }
  ], // missing fields
  amount_total: "300", // should be number
  amount_paid: 100,
  amount_credit: 200,
  confidence: 1.5, // > 1
  uncertainties: []
};

function runTest() {
  console.log("Testing valid JSON...");
  const validResult = extractionSchema.safeParse(validJson);
  if (validResult.success) {
    console.log("✅ Valid JSON passed!");
  } else {
    console.error("❌ Valid JSON failed:", validResult.error);
  }

  console.log("\nTesting invalid JSON...");
  const invalidResult = extractionSchema.safeParse(invalidJson);
  if (!invalidResult.success) {
    console.log("✅ Invalid JSON correctly rejected!");
    // console.log("Errors:", invalidResult.error.errors);
  } else {
    console.error("❌ Invalid JSON passed (should have failed)!");
  }
}

runTest();
