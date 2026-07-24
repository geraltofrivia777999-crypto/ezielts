export const WHATSAPP_PAYMENT_URL = "https://wa.me/message/R2O6CNBXJ7NAH1";
export const TELEGRAM_PAYMENT_URL = "https://t.me/m/LglRVhWbYmRi";
export const PAYMENT_CTA_LABEL = "Оплатить";

export const PAYMENT_OPTIONS = [
  {
    label: "Написать в WhatsApp",
    href: WHATSAPP_PAYMENT_URL,
    description: "Откроется чат с менеджером в WhatsApp.",
  },
  {
    label: "Написать в Telegram",
    href: TELEGRAM_PAYMENT_URL,
    description: "Откроется чат с менеджером в Telegram.",
  },
] as const;
