import { Navigate } from "react-router-dom";

/**
 * L'ancienne liste « Dépenses bexio » : fusionnée dans « Dépenses », où les
 * dépenses bexio absentes de l'application ont le filtre « Pas dans
 * l'application ».
 */
export default function BexioExpensesRedirect() {
  return <Navigate replace to="/expenses?issue=not_in_app" />;
}
