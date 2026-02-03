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
EventSchema.pre("save", async function () {
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

  // Normalize date to strict YYYY-MM-DD using local calendar date if modified
  if (this.isModified("date")) {
    const raw = this.date;
    const re = /^\d{4}-\d{2}-\d{2}$/;
    if (typeof raw !== "string" || !re.test(raw)) {
      throw new Error(
        "Date must be in the format YYYY-MM-DD; parsing uses the local calendar date."
      );
    }

    const [y, m, d] = raw.split("-");
    const year = parseInt(y, 10);
    const month = parseInt(m, 10);
    const day = parseInt(d, 10);

    // Construct a local date (midnight local time) and validate components
    const localDate = new Date(year, month - 1, day);
    if (
      isNaN(localDate.getTime()) ||
      localDate.getFullYear() !== year ||
      localDate.getMonth() !== month - 1 ||
      localDate.getDate() !== day
    ) {
      throw new Error("Date is not a valid calendar date.");
    }

    // Recompose as zero-padded YYYY-MM-DD
    const mm = String(month).padStart(2, "0");
    const dd = String(day).padStart(2, "0");
    this.date = `${year}-${mm}-${dd}`;
  }

  // Normalize time format (HH:MM) if modified
  if (this.isModified("time")) {
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(this.time)) {
      throw new Error("Time must be in HH:MM format (e.g., 14:30 or 09:00)");
    }

    // Ensure consistent format with leading zeros
    const [hours, minutes] = this.time.split(":");
    this.time = `${hours.padStart(2, "0")}:${minutes.padStart(2, "0")}`;
  }
});

// Use existing model if available (prevents recompilation in development)
const Event = models.Event || model<IEvent>("Event", EventSchema);

export default Event;
