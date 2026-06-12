export const WHATSAPP_PAYMENT_URL = "https://wa.me/message/R2O6CNBXJ7NAH1";
export const TELEGRAM_PAYMENT_URL = "https://t.me/m/LglRVhWbYmRi";
export const PAYMENT_CTA_LABEL = "Оплатить";

export const PAYMENT_OPTIONS = [
  {
    label: "Оплатить через Telegram",
    href: TELEGRAM_PAYMENT_URL,
    description: "Откроется чат оплаты в Telegram.",
  },
  {
    label: "Оплатить через WhatsApp",
    href: WHATSAPP_PAYMENT_URL,
    description: "Откроется чат оплаты в WhatsApp.",
  },
] as const;
