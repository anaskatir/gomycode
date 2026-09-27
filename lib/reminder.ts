import type { Customer, Reminder, Transaction } from "./types";

/** Message français pour le client, avec le nouveau solde. Ouvert dans WhatsApp via wa.me. */
export function buildReminder(customer: Customer, tx: Transaction, shopName: string): Reminder {
  const first = customer.name.split(" ")[0];
  const balance = Math.round(customer.balance * 100) / 100;
  const items = tx.items.map((i) => `${i.quantity} ${i.unit} ${i.product}`).join(", ");

  let message: string;
  if (tx.intent === "payment") {
    message = `Salam ${first}, tu as payé ${tx.amount_paid} dh aujourd'hui.`;
  } else if (tx.amount_paid > 0) {
    message = `Salam ${first}, aujourd'hui : ${items}. Tu as payé ${tx.amount_paid} dh.`;
  } else {
    message = `Salam ${first}, aujourd'hui à crédit : ${items}.`;
  }

  message += balance > 0 ? ` Il te reste ${balance} dh.` : " Tu ne dois plus rien.";
  if (tx.pointsEarned && tx.pointsEarned > 0) {
    message += ` +${tx.pointsEarned} points (total ${customer.points}).`;
  }
  message += ` Merci, ${shopName}.`;

  return {
    message,
    waLink: `https://wa.me/${customer.phone}?text=${encodeURIComponent(message)}`,
  };
}
