import type { Customer, Reminder, Transaction } from "./types";

/** Message darija envoyé au client avec son nouveau solde, ouvert dans WhatsApp par un lien wa.me. */
export function buildReminder(customer: Customer, tx: Transaction, shopName: string): Reminder {
  const first = customer.name.split(" ")[0];
  const balance = Math.round(customer.balance * 100) / 100;
  const items = tx.items.map((i) => `${i.quantity} ${i.unit} ${i.product}`).join(", ");

  let message: string;
  if (tx.intent === "payment") {
    message = `Salam ${first}, khallasti ${tx.amount_paid} dh lyoum.`;
  } else if (tx.amount_paid > 0) {
    message = `Salam ${first}, lyoum khditi ${items}, khallasti ${tx.amount_paid} dh.`;
  } else {
    message = `Salam ${first}, lyoum khditi ${items} b kredi.`;
  }

  message +=
    balance > 0 ? ` Baqi 3lik ${balance} dh.` : " Ma baqi 3lik walou, Allah ykhellik.";
  message += ` Chokran, ${shopName}.`;

  return {
    message,
    waLink: `https://wa.me/${customer.phone}?text=${encodeURIComponent(message)}`,
  };
}
