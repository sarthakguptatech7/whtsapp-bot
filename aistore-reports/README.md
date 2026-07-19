# AIstore WhatsApp reports

This small service adapts the QR-paired Baileys session pattern from [sarthakguptatech7/whtsapp-bot](https://github.com/sarthakguptatech7/whtsapp-bot) for owner intelligence reports. It generates a detailed PDF, sends it as a WhatsApp document, and stores local schedule/delivery metadata.

## Local setup

1. Copy `.env.example` to `.env` and set the optional admin phone number.
2. Run `npm install` in this directory.
3. Run `npm start`.
4. Open **WhatsApp reports** in the dashboard and scan the shown QR from WhatsApp **Linked devices**.
5. Enter an owner number in E.164 format, such as `+919876543210`.

The paired WhatsApp session is stored in `.whatsapp-session/`; schedules and delivery history are stored in `.report-state/`. Both are ignored by Git. Keep the service private and protect these directories in production.

## API

- `GET /api/whatsapp/status` — pairing state and QR image
- `POST /api/reports/preview` — download a generated PDF
- `POST /api/reports/send` — explicitly send the PDF to one owner
- `POST /api/alerts/send` — immediately send a security evidence image to one owner
- `GET|POST /api/schedules` — list or create owner schedules
- `DELETE /api/schedules/:id` — remove a schedule
- `GET /api/reports/history` — recent real deliveries

Security alerts may omit the recipient from the browser request; the service uses its server-side `DEFAULT_OWNER_PHONE_NUMBER`. This keeps the owner number out of the public dashboard bundle while preserving immediate evidence delivery.

Baileys connects through WhatsApp Web and is not the official WhatsApp Business Cloud API. For a long-lived production rollout, use a dedicated business number, obtain recipient consent, and evaluate migration to the official API.
