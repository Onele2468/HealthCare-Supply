import {
  LayoutDashboard, Package, Warehouse, Boxes, ClipboardList, Truck, Building2,
  KeyRound, Users, BarChart3, Mail, Settings, Network, Factory, Store, Wrench,
  ShoppingCart, Send, ShoppingBag, Route as RouteIcon, UserCog, FileText, Inbox,
} from "lucide-react";

export type IconType = typeof LayoutDashboard;
export type NavItem = { to: string; label: string; icon: IconType };

/** Healthcare-focused organization types. Values stay stable for existing data. */
export const BUSINESS_TYPES = [
  { value: "buyer",        label: "Hospital / Clinic" },
  { value: "supplier",     label: "Medical Supplier" },
  { value: "manufacturer", label: "Pharmaceutical Manufacturer" },
  { value: "distributor",  label: "Healthcare Distributor" },
  { value: "warehouse",    label: "Medical Warehouse" },
  { value: "retailer",     label: "Pharmacy" },
  { value: "wholesaler",   label: "Medical Wholesaler" },
  { value: "logistics",    label: "Cold-Chain Logistics" },
  { value: "transport",    label: "Medical Transport" },
] as const;

export const OWNERSHIP_OPTIONS = [
  { value: "private",      label: "Private Practice / Company" },
  { value: "government",   label: "Government Health Department" },
  { value: "municipality", label: "Municipality Health Services" },
  { value: "soe",          label: "State-Owned Health Entity" },
  { value: "ngo",          label: "NGO / Non-Profit Clinic" },
  { value: "education",    label: "Teaching Hospital / University" },
  { value: "other",        label: "Other" },
] as const;

/** Healthcare-only sector focus. */
export const INDUSTRY_OPTIONS = [
  "Hospital", "Clinic", "Pharmacy", "Laboratory", "Diagnostic Imaging",
  "Dental Practice", "Optometry", "Veterinary", "Public Health",
  "Medical Devices", "Pharmaceuticals", "Biotechnology",
  "Home Care / Nursing", "Emergency Medical Services", "Other Healthcare",
] as const;

/** Healthcare product categories used across catalog & marketplace filters. */
export const HEALTHCARE_CATEGORIES = [
  "Medicines & Pharmaceuticals",
  "Medical Consumables",
  "Medical Equipment",
  "Laboratory Supplies",
  "Dental Supplies",
  "Surgical Instruments",
  "Diagnostic Devices",
  "Infection Prevention & PPE",
  "Cleaning & Sanitation",
  "Clinic Operational Supplies",
  "Cold-Chain & Vaccines",
  "Nutrition & Dietary",
] as const;

const COMMON_TAIL: NavItem[] = [
  { to: "/marketplace",  label: "Marketplace",        icon: Store },
  { to: "/network",      label: "Healthcare Network", icon: Network },
  { to: "/reports",      label: "Reports",            icon: BarChart3 },
  { to: "/organization", label: "Organization",       icon: Building2 },
  { to: "/invitations",  label: "Invitations",        icon: Mail },
  { to: "/api-keys",     label: "API Keys",           icon: KeyRound },
  { to: "/settings",     label: "Settings",           icon: Settings },
];

const dash: NavItem = { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard };

const NAV_BY_TYPE: Record<string, NavItem[]> = {
  buyer: [
    dash,
    { to: "/catalog",         label: "Products",        icon: Package },
    { to: "/suppliers",       label: "Suppliers",       icon: Users },
    { to: "/rfqs",            label: "RFQs",            icon: FileText },
    { to: "/quotations",      label: "Quotations",      icon: FileText },
    { to: "/purchase-orders", label: "Purchase Orders", icon: ClipboardList },
    { to: "/deliveries",      label: "Deliveries",      icon: Truck },
  ],
  supplier: [
    dash,
    { to: "/catalog",         label: "Products",   icon: Package },
    { to: "/suppliers",       label: "Customers",  icon: Users },
    { to: "/rfqs",            label: "RFQ Inbox",  icon: Inbox },
    { to: "/quotations",      label: "Quotations", icon: FileText },
    { to: "/warehouses",      label: "Warehouses", icon: Warehouse },
    { to: "/inventory",       label: "Inventory",  icon: Boxes },
    { to: "/purchase-orders", label: "Orders",     icon: ShoppingCart },
    { to: "/deliveries",      label: "Dispatch",   icon: Send },
  ],
  manufacturer: [
    dash,
    { to: "/catalog",         label: "Products",          icon: Package },
    { to: "/warehouses",      label: "Factories",         icon: Factory },
    { to: "/inventory",       label: "Raw Materials",     icon: Wrench },
    { to: "/rfqs",            label: "RFQ Inbox",         icon: Inbox },
    { to: "/quotations",      label: "Quotations",        icon: FileText },
    { to: "/purchase-orders", label: "Production Orders", icon: ClipboardList },
    { to: "/deliveries",      label: "Shipments",         icon: Truck },
    { to: "/suppliers",       label: "Buyers",            icon: Users },
  ],
  distributor: [
    dash,
    { to: "/catalog",         label: "Products",     icon: Package },
    { to: "/suppliers",       label: "Partners",     icon: Users },
    { to: "/warehouses",      label: "Warehouses",   icon: Warehouse },
    { to: "/inventory",       label: "Inventory",    icon: Boxes },
    { to: "/rfqs",            label: "RFQs",         icon: FileText },
    { to: "/quotations",      label: "Quotations",   icon: FileText },
    { to: "/purchase-orders", label: "Orders",       icon: ClipboardList },
    { to: "/deliveries",      label: "Distribution", icon: Truck },
  ],
  warehouse: [
    dash,
    { to: "/warehouses",      label: "Storage",   icon: Warehouse },
    { to: "/inventory",       label: "Inventory", icon: Boxes },
    { to: "/purchase-orders", label: "Receiving", icon: ShoppingCart },
    { to: "/deliveries",      label: "Dispatch",  icon: Send },
  ],
  retailer: [
    dash,
    { to: "/catalog",         label: "Products",    icon: Package },
    { to: "/suppliers",       label: "Suppliers",   icon: Users },
    { to: "/inventory",       label: "Stock",       icon: Boxes },
    { to: "/rfqs",            label: "RFQs",        icon: FileText },
    { to: "/quotations",      label: "Quotations",  icon: FileText },
    { to: "/purchase-orders", label: "Orders",      icon: ClipboardList },
    { to: "/deliveries",      label: "Deliveries",  icon: Truck },
  ],
  wholesaler: [
    dash,
    { to: "/catalog",         label: "Products",   icon: Package },
    { to: "/warehouses",      label: "Warehouses", icon: Warehouse },
    { to: "/inventory",       label: "Inventory",  icon: Boxes },
    { to: "/suppliers",       label: "Customers",  icon: Users },
    { to: "/rfqs",            label: "RFQ Inbox",  icon: Inbox },
    { to: "/quotations",      label: "Quotations", icon: FileText },
    { to: "/purchase-orders", label: "Orders",     icon: ShoppingBag },
    { to: "/deliveries",      label: "Dispatch",   icon: Send },
  ],
  logistics: [
    dash,
    { to: "/warehouses",      label: "Fleet",      icon: Truck },
    { to: "/inventory",       label: "Drivers",    icon: UserCog },
    { to: "/deliveries",      label: "Deliveries", icon: Truck },
    { to: "/purchase-orders", label: "Routes",     icon: RouteIcon },
    { to: "/suppliers",       label: "Customers",  icon: Users },
  ],
  transport: [
    dash,
    { to: "/warehouses",      label: "Fleet",      icon: Truck },
    { to: "/deliveries",      label: "Trips",      icon: Truck },
    { to: "/suppliers",       label: "Clients",    icon: Users },
  ],
};

export function getNavForType(type?: string | null): NavItem[] {
  const base = (type && NAV_BY_TYPE[type]) || [dash, { to: "/catalog", label: "Products", icon: Package }];
  return [...base, ...COMMON_TAIL];
}

export type WidgetKey =
  | "products" | "warehouses" | "inventory_value" | "low_stock" | "expiring"
  | "shipments_in" | "shipments_out" | "po_open" | "po_recent_spend"
  | "so_recent_revenue" | "so_open" | "suppliers" | "customers"
  | "storage_capacity" | "fleet" | "active_deliveries";

export function getDashboardForType(type?: string | null): { title: string; widgets: WidgetKey[] } {
  switch (type) {
    case "buyer":
      return { title: "Buyer overview", widgets: ["suppliers","po_open","shipments_in","po_recent_spend","low_stock","products"] };
    case "supplier":
      return { title: "Supplier overview", widgets: ["customers","products","so_open","shipments_out","so_recent_revenue","warehouses","inventory_value","low_stock"] };
    case "manufacturer":
      return { title: "Manufacturer overview", widgets: ["products","po_open","inventory_value","warehouses","customers","shipments_out"] };
    case "distributor":
      return { title: "Distributor overview", widgets: ["suppliers","customers","warehouses","inventory_value","po_open","shipments_out"] };
    case "warehouse":
      return { title: "Warehouse overview", widgets: ["warehouses","storage_capacity","inventory_value","low_stock","shipments_in","shipments_out"] };
    case "retailer":
      return { title: "Retail overview", widgets: ["suppliers","products","inventory_value","low_stock","po_open","shipments_in"] };
    case "wholesaler":
      return { title: "Wholesale overview", widgets: ["customers","products","warehouses","inventory_value","so_open","shipments_out"] };
    case "logistics":
    case "transport":
      return { title: "Logistics overview", widgets: ["fleet","active_deliveries","customers","shipments_out"] };
    default:
      return { title: "Overview", widgets: ["products","warehouses","po_open","shipments_in","low_stock"] };
  }
}

export function getRoleLabel(type?: string | null): string {
  const m = BUSINESS_TYPES.find((t) => t.value === type);
  return m?.label ?? (type ?? "Organization");
}
