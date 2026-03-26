export type PhotoType = "completion" | "dispute";

export interface BookingPhoto {
  id: string;
  booking_id: string;
  uploaded_by: string;
  photo_url: string;
  type: PhotoType;
  room_label: string | null;
  created_at: string;
}
