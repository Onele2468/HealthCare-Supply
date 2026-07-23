import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listProducts from "./tools/list-products";
import listInventory from "./tools/list-inventory";
import listPurchaseOrders from "./tools/list-purchase-orders";
import listConnections from "./tools/list-connections";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "smart-supply-mcp",
  title: "Smart Supply",
  version: "0.1.0",
  instructions:
    "Tools for Smart Supply, a healthcare procurement platform. Query the signed-in user's products, inventory, purchase orders, and business connections. All calls are scoped to the user's organization via Row-Level Security.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listProducts, listInventory, listPurchaseOrders, listConnections],
});
