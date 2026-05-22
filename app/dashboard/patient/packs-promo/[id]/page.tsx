import { PatientPromoReservationDetail } from "@/components/promo/patient-promo-reservation-detail";

export default async function PatientPacksPromoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <PatientPromoReservationDetail reservationId={id} />;
}
