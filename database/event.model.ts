import { Schema, model, models, Document } from "mongoose";

// TypeScript interface for Event document
export interface IEvent extends Document {
  title: string;
  slug: string;
  description: string;
  overview: string;
  image: string;
  venue: string;
  location: string;
  date: string;
  time: string;
  mode: string;
  audience: string;
  agenda: string[];
  organizer: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

const EventSchema = new Schema<IEvent>(
  {
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
    },
    slug: {
      type: String,
      unique: true,
      lowercase: true,
      trim: true,
    },
    description: {
      type: String,
      required: [true, "Description is required"],
      trim: true,
    },
    overview: {
      type: String,
      required: [true, "Overview is required"],
      trim: true,
    },
    image: {
      type: String,
      required: [true, "Image is required"],
    },
    venue: {
      type: String,
      required: [true, "Venue is required"],
      trim: true,
    },
    location: {
      type: String,
      required: [true, "Location is required"],
      trim: true,
    },
    date: {
      type: String,
      required: [true, "Date is required"],
    },
    time: {
      type: String,
      required: [true, "Time is required"],
    },
    mode: {
      type: String,
      required: [true, "Mode is required"],
      enum: {
        values: ["online", "offline", "hybrid"],
        message: "Mode must be online, offline, or hybrid",
      },
    },
    audience: {
      type: String,
      required: [true, "Audience is required"],
      trim: true,
    },
    agenda: {
      type: [String],
      required: [true, "Agenda is required"],
      validate: {
        validator: (v: string[]) => v.length > 0,
        message: "Agenda must have at least one item",
      },
    },
    organizer: {
      type: String,
      required: [true, "Organizer is required"],
      trim: true,
    },
    tags: {
      type: [String],
      required: [true, "Tags are required"],
      validate: {
        validator: (v: string[]) => v.length > 0,
        message: "Tags must have at least one item",
      },
    },
  },
  {
    timestamps: true, // Auto-generate createdAt and updatedAt
  }
);

// Create unique index on slug for faster lookups
EventSchema.index({ slug: 1 }, { unique: true });

/**
 * Pre-save hook to auto-generate slug and normalize date/time
 * Only regenerates slug when title is modified
 */
EventSchema.pre("save", async function (next) {
  // Generate slug from title if title is modified or document is new
  if (this.isModified("title")) {
    const baseSlug = this.title
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, "") // Remove special characters
      .replace(/\s+/g, "-") // Replace spaces with hyphens
      .replace(/-+/g, "-"); // Replace multiple hyphens with single hyphen

    // Ensure slug uniqueness by appending timestamp if needed
    let slug = baseSlug;
    let counter = 1;

    // Check if slug exists (skip for current document on update)
    while (true) {
      const existingEvent = await models.Event.findOne({
        slug,
        _id: { $ne: this._id },
      });

      if (!existingEvent) break;

      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    this.slug = slug;
  }

  // Normalize date to ISO format if modified
  if (this.isModified("date")) {
    try {
      const dateObj = new Date(this.date);
      if (isNaN(dateObj.getTime())) {
        throw new Error("Invalid date format");
      }
      // Store as ISO date string (YYYY-MM-DD)
      this.date = dateObj.toISOString().split("T")[0];
    } catch (error) {
      return next(
        new Error("Date must be a valid date string (e.g., YYYY-MM-DD)")
      );
    }
  }

  // Normalize time format (HH:MM) if modified
  if (this.isModified("time")) {
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(this.time)) {
      return next(
        new Error("Time must be in HH:MM format (e.g., 14:30 or 09:00)")
      );
    }

    // Ensure consistent format with leading zeros
    const [hours, minutes] = this.time.split(":");
    this.time = `${hours.padStart(2, "0")}:${minutes.padStart(2, "0")}`;
  }

  next();
});

// Use existing model if available (prevents recompilation in development)
const Event = models.Event || model<IEvent>("Event", EventSchema);

export default Event;
