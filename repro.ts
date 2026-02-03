
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import Booking from './database/booking.model';
import Event from './database/event.model';

async function runReproduction() {
  const mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);

  console.log('--- TEST 1: runSettersOnQuery bypass (lowercase email) ---');
  try {
    // 1. Create an event
    const event = await Event.create({
      title: 'Test Event',
      description: 'Test Description',
      overview: 'Test Overview',
      image: 'test.jpg',
      venue: 'Test Venue',
      location: 'Test Location',
      date: '2025-01-01',
      time: '10:00',
      mode: 'online',
      audience: 'Test Audience',
      agenda: ['Test Agenda'],
      organizer: 'Test Organizer',
      tags: ['Test Tag']
    });

    // 2. Create a booking (email will be lowercased by save hook/setter)
    await Booking.create({
      eventId: event._id,
      email: 'TEST@EXAMPLE.COM'
    });
    
    const b1 = await Booking.findOne({ eventId: event._id });
    console.log('Created booking email:', b1?.email); // should be 'test@example.com'

    // 3. Attempt to update another booking to have the same email but in different case via findOneAndUpdate
    // In Mongoose < 7, lowercase setter doesn't run on findOneAndUpdate by default unless runSettersOnQuery is true.
    // If it's bypassed, this might succeed or at least skip the setter.
    
    // Create a second booking
    await Booking.create({
      eventId: event._id,
      email: 'other@example.com'
    });

    console.log('Updating second booking with uppercase email...');
    try {
      await Booking.findOneAndUpdate(
        { email: 'other@example.com' },
        { email: 'TEST@EXAMPLE.COM' },
        { new: true, runValidators: true }
      );
    } catch (e: any) {
      console.log('Update failed (expected if unique index catches it after lowercasing):', e.message);
    }

    const b2 = await Booking.findOne({ email: 'test@example.com', _id: { $ne: b1?._id } });
    console.log('Second booking email after update:', b2?.email);
    
    if (b2?.email === 'TEST@EXAMPLE.COM') {
      console.log('FAILURE: email setter was bypassed (remained uppercase)');
    } else {
      console.log('SUCCESS: email setter was applied (lowercased)');
    }

  } catch (error: any) {
    console.log('Caught expected or unexpected error in Test 1:', error.message);
  }

  console.log('\n--- TEST 2: eventId validation bypass on update ---');
  try {
    const event = await Event.findOne();
    const booking = await Booking.create({
      eventId: event!._id,
      email: 'val@example.com'
    });

    const fakeId = new mongoose.Types.ObjectId();
    console.log('Updating booking with non-existent eventId:', fakeId);
    
    await Booking.findOneAndUpdate(
      { _id: booking._id },
      { eventId: fakeId },
      { runValidators: true }
    );

    const updatedBooking = await Booking.findById(booking._id);
    if (updatedBooking?.eventId.toString() === fakeId.toString()) {
      console.log('FAILURE: eventId validation was bypassed (updated to non-existent ID)');
    } else {
      console.log('SUCCESS: eventId validation prevented update');
    }
  } catch (error: any) {
    console.log('Caught expected error in Test 2:', error.message);
  }

  await mongoose.disconnect();
  await mongoServer.stop();
}

runReproduction().catch(console.error);
