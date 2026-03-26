import { redirect } from "next/navigation";

// Search is integrated into the client home page (split map/list view with filters)
export default function ClientSearchPage() {
  redirect("/client");
}
