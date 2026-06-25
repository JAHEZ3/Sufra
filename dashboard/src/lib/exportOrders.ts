// Zero-dependency Excel export for orders.
//
// We emit a SpreadsheetML 2003 workbook (.xls). Excel opens it natively as a
// real spreadsheet — typed number cells, frozen bold header, column widths and
// right-to-left layout — without needing SheetJS/exceljs in the bundle.

import {
  Order,
  LocalOrderStatus,
  LocalServiceType,
} from "@/types/order.types";
import { formatDate, formatTime } from "@/lib/utils";

const localStatusLabel: Record<string, string> = {
  [LocalOrderStatus.OPEN]: "مفتوحة",
  [LocalOrderStatus.PREPARING]: "قيد التحضير",
  [LocalOrderStatus.DONE]: "مكتملة",
  [LocalOrderStatus.VOIDED]: "ملغاة",
};

const posPaymentMethodLabel: Record<string, string> = {
  cash: "نقدًا",
  card: "بطاقة",
  online: "أونلاين",
  wallet: "محفظة",
};

function serviceLabel(o: Order): string {
  if (o.serviceType === LocalServiceType.DINE_IN) return "صالة";
  if (o.serviceType === LocalServiceType.TAKEAWAY) return "سفري";
  return "—";
}

function itemsLabel(o: Order): string {
  return o.items.map((it) => `${it.mealName} ×${it.quantity}`).join(" + ");
}

function paidTotal(o: Order): number {
  return (o.paymentSplits ?? []).reduce((sum, s) => sum + (Number(s.amount) || 0), 0);
}

function paymentMethodsLabel(o: Order): string {
  const methods = (o.paymentSplits ?? []).map(
    (s) => posPaymentMethodLabel[s.method] ?? s.method,
  );
  return Array.from(new Set(methods)).join("، ");
}

const esc = (v: unknown): string =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

type Col = {
  header: string;
  width: number; // approx pixels
  value: (o: Order) => string | number;
  type: "String" | "Number";
};

const COLUMNS: Col[] = [
  { header: "رقم الطلب", width: 110, type: "String", value: (o) => o.orderNumber },
  { header: "النوع", width: 70, type: "String", value: serviceLabel },
  { header: "الطاولة", width: 60, type: "String", value: (o) => o.tableNumber ?? "—" },
  { header: "العميل", width: 130, type: "String", value: (o) => o.customerName || "—" },
  { header: "الهاتف", width: 110, type: "String", value: (o) => o.customerPhone || "—" },
  {
    header: "الحالة",
    width: 80,
    type: "String",
    value: (o) => localStatusLabel[o.localStatus ?? ""] ?? o.localStatus ?? "—",
  },
  { header: "الوجبات", width: 300, type: "String", value: itemsLabel },
  { header: "عدد الأصناف", width: 80, type: "Number", value: (o) => o.items.length },
  { header: "المجموع الفرعي", width: 95, type: "Number", value: (o) => o.subtotal },
  { header: "الخصم", width: 70, type: "Number", value: (o) => o.discountAmount },
  { header: "الإجمالي", width: 90, type: "Number", value: (o) => o.totalAmount },
  { header: "طريقة الدفع", width: 110, type: "String", value: paymentMethodsLabel },
  { header: "المدفوع", width: 90, type: "Number", value: paidTotal },
  { header: "التاريخ", width: 100, type: "String", value: (o) => formatDate(o.createdAt) },
  { header: "الوقت", width: 80, type: "String", value: (o) => formatTime(o.createdAt) },
];

function cell(value: string | number, type: "String" | "Number", styleId?: string): string {
  const s = styleId ? ` ss:StyleID="${styleId}"` : "";
  if (type === "Number") {
    const n = Number(value);
    return `<Cell${s}><Data ss:Type="Number">${Number.isFinite(n) ? n : 0}</Data></Cell>`;
  }
  return `<Cell${s}><Data ss:Type="String">${esc(value)}</Data></Cell>`;
}

export function buildOrdersWorkbook(orders: Order[]): string {
  const cols = COLUMNS.map(
    (c) => `<Column ss:Width="${Math.round(c.width * 0.75)}"/>`,
  ).join("");

  const header =
    "<Row ss:Height=\"22\">" +
    COLUMNS.map((c) => cell(c.header, "String", "head")).join("") +
    "</Row>";

  const body = orders
    .map(
      (o) =>
        "<Row>" +
        COLUMNS.map((c) => cell(c.value(o), c.type, c.type === "Number" ? "money" : undefined)).join("") +
        "</Row>",
    )
    .join("");

  // Totals row.
  const totalSum = orders.reduce((s, o) => s + (Number(o.totalAmount) || 0), 0);
  const paidSum = orders.reduce((s, o) => s + paidTotal(o), 0);
  const totals =
    "<Row ss:Height=\"20\">" +
    cell("الإجمالي", "String", "head") +
    Array.from({ length: 9 }).map(() => "<Cell ss:StyleID=\"head\"/>").join("") +
    cell(totalSum, "Number", "headMoney") +
    "<Cell ss:StyleID=\"head\"/>" +
    cell(paidSum, "Number", "headMoney") +
    "<Cell ss:StyleID=\"head\"/><Cell ss:StyleID=\"head\"/>" +
    "</Row>";

  return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal"><Alignment ss:Vertical="Center" ss:ReadingOrder="RightToLeft"/><Font ss:FontName="Arial" ss:Size="11"/></Style>
  <Style ss:ID="head"><Font ss:FontName="Arial" ss:Size="11" ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#1f8a5b" ss:Pattern="Solid"/><Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:ReadingOrder="RightToLeft"/></Style>
  <Style ss:ID="money"><NumberFormat ss:Format="#,##0.00"/></Style>
  <Style ss:ID="headMoney"><Font ss:FontName="Arial" ss:Size="11" ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#1f8a5b" ss:Pattern="Solid"/><NumberFormat ss:Format="#,##0.00"/></Style>
 </Styles>
 <Worksheet ss:Name="الطلبات">
  <Table>${cols}${header}${body}${totals}</Table>
  <WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel">
   <DisplayRightToLeft/>
   <FreezePanes/><FrozenNoColor/><SplitHorizontal>1</SplitHorizontal><TopRowBottomPane>1</TopRowBottomPane><ActivePane>2</ActivePane>
  </WorksheetOptions>
 </Worksheet>
</Workbook>`;
}

export function downloadOrdersExcel(orders: Order[], fileName?: string): void {
  const xml = buildOrdersWorkbook(orders);
  // UTF-8 BOM so Excel detects Arabic encoding correctly.
  const blob = new Blob(["﻿", xml], {
    type: "application/vnd.ms-excel;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const stamp = new Date().toISOString().slice(0, 10);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName ?? `orders-${stamp}.xls`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
