import { redirect } from "next/navigation";

// Cleaners don't need a search page — redirect to cleaner home
export default function CleanerSearchPage() {
  redirect("/cleaner");
}
