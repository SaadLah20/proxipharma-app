import { PharmacistPromoReservationDetail } from "@/components/promo/pharmacist-promo-reservation-detail";

export default async function PharmacienReservationPackDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <PharmacistPromoReservationDetail reservationId={id} />;
}
