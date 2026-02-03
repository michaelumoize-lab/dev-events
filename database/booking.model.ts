import { Schema, model, models, Document, Types } from "mongoose";

// TypeScript interface for Booking document
export interface IBooking extends Document {
  eventId: Types.ObjectId;
  email: string;
  createdAt: Date;
  updatedAt: Date;
}

const BookingSchema = new Schema<IBooking>(
  {
    eventId: {
      type: Schema.Types.ObjectId,
      ref: "Event",
      required: [true, "Event ID is required"],
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      trim: true,
      lowercase: true,
      match: [
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        "Please provide a valid email address",
      ],
    },
  },
  {
    timestamps: true, // Auto-generate createdAt and updatedAt
  }
);

// Create index on eventId for faster queries
BookingSchema.index({ eventId: 1 });

// Compound index for preventing duplicate bookings (same email for same event)
BookingSchema.index({ eventId: 1, email: 1 }, { unique: true });

/**
 * Pre-save hook to validate that the referenced event exists
 * Prevents orphaned bookings by checking Event collection
 */
BookingSchema.pre("save", async function (next) {
  // Only validate eventId if it's modified or new document
  if (this.isModified("eventId")) {
    try {
      // Check if the referenced event exists
      const Event = models.Event || model("Event");
      const eventExists = await Event.findById(this.eventId);

      if (!eventExists) {
        return next(
          new Error(
            `Event with ID ${this.eventId} does not exist. Cannot create booking for non-existent event.`
          )
        );
      }
    } catch (error) {
      return next(
        new Error(
          `Failed to validate event reference: ${error instanceof Error ? error.message : "Unknown error"}`
        )
      );
    }
  }

  next();
});

// Use existing model if available (prevents recompilation in development)
const Booking = models.Booking || model<IBooking>("Booking", BookingSchema);

export default Booking;
