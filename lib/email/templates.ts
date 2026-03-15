const BRAND_COLOR = '#ec5b13'
const FONT = `font-family: 'Public Sans', Arial, sans-serif;`

function base(content: string, previewText: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>CMRTC Gate Pass System</title>
  <!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
</head>
<body style="margin:0;padding:0;background:#f8f6f6;${FONT}">
  <!-- Preview text (hidden) -->
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${previewText}&nbsp;‌&nbsp;‌&nbsp;‌</div>

  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f6f6;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:520px;" cellpadding="0" cellspacing="0">

        <!-- Header -->
        <tr>
          <td style="background:#ffffff;border-radius:12px 12px 0 0;padding:28px 32px 20px;border-bottom:3px solid ${BRAND_COLOR};text-align:center;">
            <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:2px;color:#888;text-transform:uppercase;">CMR Technical Campus</p>
            <p style="margin:0;font-size:18px;font-weight:700;color:#1a1a1a;">Gate Pass Approval System</p>
            <p style="margin:4px 0 0;font-size:11px;color:#aaa;">Department of CSE (AI &amp; ML)</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="background:#ffffff;padding:28px 32px;">
            ${content}
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f1eeee;border-radius:0 0 12px 12px;padding:16px 32px;text-align:center;">
            <p style="margin:0;font-size:11px;color:#aaa;">
              This is an automated notification from the CMRTC Gate Pass System.<br />
              Please do not reply to this email.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
}

function badge(label: string, color: string, bg: string): string {
  return `<span style="display:inline-block;padding:3px 10px;border-radius:999px;font-size:11px;font-weight:700;background:${bg};color:${color};letter-spacing:0.5px;">${label}</span>`
}

function infoRow(icon: string, label: string, value: string): string {
  return `
  <tr>
    <td style="padding:7px 0;border-bottom:1px solid #f1eeee;">
      <table cellpadding="0" cellspacing="0" width="100%"><tr>
        <td style="width:20px;font-size:16px;">${icon}</td>
        <td style="padding-left:10px;">
          <span style="font-size:12px;color:#888;">${label}: </span>
          <span style="font-size:12px;color:#1a1a1a;font-weight:600;">${value}</span>
        </td>
      </tr></table>
    </td>
  </tr>`
}

function ctaButton(label: string, url: string): string {
  return `
  <table cellpadding="0" cellspacing="0" style="margin-top:24px;">
    <tr>
      <td style="background:${BRAND_COLOR};border-radius:8px;">
        <a href="${url}" style="display:inline-block;padding:12px 28px;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;letter-spacing:0.3px;">${label}</a>
      </td>
    </tr>
  </table>`
}

// ─────────────────────────────────────────────────────────────────────────────
// Template 1: HOD — new leave request submitted
// ─────────────────────────────────────────────────────────────────────────────
export interface NewRequestEmailData {
  facultyName: string
  facultyIdCode: string
  designation: string
  reason: string
  submittedAt: string
  dashboardUrl: string
}

export function newRequestEmail(data: NewRequestEmailData): { subject: string; html: string } {
  const content = `
    <p style="margin:0 0 6px;font-size:15px;font-weight:700;color:#1a1a1a;">New gate pass request submitted</p>
    <p style="margin:0 0 20px;font-size:13px;color:#666;">A faculty member is requesting a gate pass and needs your approval.</p>

    <!-- Faculty card -->
    <table cellpadding="0" cellspacing="0" width="100%" style="background:#f8f6f6;border-radius:8px;padding:16px;margin-bottom:20px;">
      <tr>
        <td>
          <p style="margin:0 0 2px;font-size:16px;font-weight:700;color:#1a1a1a;">${data.facultyName}</p>
          <p style="margin:0 0 8px;font-size:12px;color:#888;">${data.designation} &nbsp;·&nbsp; ${data.facultyIdCode}</p>
          ${badge('Pending Approval', BRAND_COLOR, '#fde8db')}
        </td>
      </tr>
    </table>

    <!-- Details -->
    <table cellpadding="0" cellspacing="0" width="100%">
      ${infoRow('📋', 'Reason', data.reason)}
      ${infoRow('🕐', 'Submitted', data.submittedAt)}
    </table>

    ${ctaButton('Review Request →', data.dashboardUrl)}
  `
  return {
    subject: `New Gate Pass Request — ${data.facultyName}`,
    html: base(content, `${data.facultyName} has submitted a gate pass request awaiting your approval.`),
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Template 2: Faculty — request approved
// ─────────────────────────────────────────────────────────────────────────────
export interface ApprovedEmailData {
  facultyName: string
  reason: string
  approvedAt: string
  dashboardUrl: string
}

export function approvedEmail(data: ApprovedEmailData): { subject: string; html: string } {
  const content = `
    <!-- Status banner -->
    <table cellpadding="0" cellspacing="0" width="100%" style="background:#f0fdf4;border-radius:8px;padding:16px;margin-bottom:20px;border-left:4px solid #22c55e;">
      <tr>
        <td>
          <p style="margin:0 0 2px;font-size:18px;">✅</p>
          <p style="margin:0 0 2px;font-size:15px;font-weight:700;color:#15803d;">Your gate pass has been approved!</p>
          <p style="margin:0;font-size:13px;color:#166534;">You may now leave campus. Present the QR code at the gate.</p>
        </td>
      </tr>
    </table>

    <p style="margin:0 0 4px;font-size:13px;color:#555;">Hi <strong>${data.facultyName}</strong>,</p>
    <p style="margin:0 0 20px;font-size:13px;color:#555;">The HOD has reviewed and approved your gate pass request. Your QR code is ready in the dashboard.</p>

    <table cellpadding="0" cellspacing="0" width="100%">
      ${infoRow('📋', 'Reason', data.reason)}
      ${infoRow('🕐', 'Approved at', data.approvedAt)}
    </table>

    ${ctaButton('Open Dashboard & View QR →', data.dashboardUrl)}

    <p style="margin:20px 0 0;font-size:11px;color:#aaa;">The QR code can only be used once. Keep it ready at the gate.</p>
  `
  return {
    subject: `Gate Pass Approved ✅ — CMRTC`,
    html: base(content, `Your gate pass request has been approved. Open the dashboard to view your QR code.`),
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Template 3: Faculty — request rejected
// ─────────────────────────────────────────────────────────────────────────────
export interface RejectedEmailData {
  facultyName: string
  reason: string
  hodRemarks: string
  dashboardUrl: string
}

export function rejectedEmail(data: RejectedEmailData): { subject: string; html: string } {
  const content = `
    <!-- Status banner -->
    <table cellpadding="0" cellspacing="0" width="100%" style="background:#fff1f1;border-radius:8px;padding:16px;margin-bottom:20px;border-left:4px solid #ef4444;">
      <tr>
        <td>
          <p style="margin:0 0 2px;font-size:18px;">❌</p>
          <p style="margin:0 0 2px;font-size:15px;font-weight:700;color:#b91c1c;">Your gate pass request was not approved.</p>
          <p style="margin:0;font-size:13px;color:#991b1b;">Please review the HOD's remarks below and resubmit if needed.</p>
        </td>
      </tr>
    </table>

    <p style="margin:0 0 4px;font-size:13px;color:#555;">Hi <strong>${data.facultyName}</strong>,</p>
    <p style="margin:0 0 20px;font-size:13px;color:#555;">Your gate pass request has been reviewed and could not be approved at this time.</p>

    <table cellpadding="0" cellspacing="0" width="100%">
      ${infoRow('📋', 'Your reason', data.reason)}
      ${infoRow('💬', 'HOD remarks', data.hodRemarks || 'No remarks provided.')}
    </table>

    ${ctaButton('Go to Dashboard →', data.dashboardUrl)}
  `
  return {
    subject: `Gate Pass Request Not Approved — CMRTC`,
    html: base(content, `Your gate pass request has not been approved. Check the HOD's remarks for details.`),
  }
}
