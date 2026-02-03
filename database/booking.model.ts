import { Schema, model, models, Document, Types } from "mongoose";
// Ensure Event schema is registered to avoid MissingSchemaError during hooks
import Event from "./event.model";

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
BookingSchema.pre("save", async function () {
  // Only validate eventId if it's modified or new document
  if (this.isModified("eventId")) {
    // Check if the referenced event exists
    const eventExists = await Event.findById((this as any).eventId);
    if (!eventExists) {
      throw new Error(
        `Event with ID ${(this as any).eventId} does not exist. Cannot create booking for non-existent event.`
      );
    }
  }
});

/**
 * Pre-findOneAndUpdate hook to validate that the referenced event exists
 * Prevents orphaned bookings during updates
 */
BookingSchema.pre("findOneAndUpdate", async function () {
  // Ensure setters run during updates (Mongoose 9: set at query level)
  this.setOptions({ runSettersOnQuery: true });

  const update = this.getUpdate() as any;
  // Check both direct field and $set operator
  const newEventId = update?.eventId ?? update?.$set?.eventId;
  if (newEventId) {
    const eventExists = await Event.findById(newEventId);
    if (!eventExists) {
      throw new Error(
        `Event with ID ${newEventId} does not exist. Cannot update booking to a non-existent event.`
      );
    }
  }
});

// Ensure setters also run for updateOne operations and validate eventId if present
BookingSchema.pre("updateOne", async function () {
  this.setOptions({ runSettersOnQuery: true });
  const update = this.getUpdate() as any;
  if (update && update.eventId) {
    const eventExists = await Event.findById(update.eventId);
    if (!eventExists) {
      throw new Error(
        `Event with ID ${update.eventId} does not exist. Cannot update booking to a non-existent event.`
      );
    }
  }
});

// Use existing model if available (prevents recompilation in development)
const Booking = models.Booking || model<IBooking>("Booking", BookingSchema);

export default Booking;
