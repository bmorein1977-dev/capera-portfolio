# External Training Management & Booking System - User Tutorial

## Overview

The External Training Management & Booking System allows users to discover, browse, and book professional training courses from external providers. This marketplace-style system provides a centralized platform for workforce development and skills enhancement.

---

## Table of Contents

1. [Accessing the System](#accessing-the-system)
2. [Browsing the Training Catalog](#browsing-the-training-catalog)
3. [Searching and Filtering Courses](#searching-and-filtering-courses)
4. [Viewing Course Details](#viewing-course-details)
5. [Booking a Training Session](#booking-a-training-session)
6. [Managing Your Bookings](#managing-your-bookings)
7. [Understanding Booking Statuses](#understanding-booking-statuses)
8. [Admin Functions](#admin-functions)

---

## Accessing the System

### Step 1: Log In
1. Navigate to the Capera platform
2. Click **"Log In"** and authenticate using your Replit account
3. Once logged in, you'll see the main dashboard

### Step 2: Navigate to Training Catalog
1. Look for the **sidebar menu** on the left side of the screen
2. Click on **"Training Catalog"** to browse available external training courses
3. Or click **"My Bookings"** to view your existing training bookings

---

## Browsing the Training Catalog

### What You'll See

When you open the Training Catalog page, you'll find:

- **Search Bar**: Search courses by title or description
- **Modality Filter**: Filter courses by delivery method (In Person, Online, or Hybrid)
- **Course Cards**: Visual cards displaying available training courses
- **Course Details**: Title, description, duration, modality, tags, and pricing

### Course Information Displayed

Each course card shows:
- **Title**: The name of the training course
- **Description**: What the course covers
- **Duration**: Length of the course in days
- **Modality**: How the course is delivered (In Person/Online/Hybrid)
- **Tags**: Skill areas covered (e.g., "Leadership", "Technical", "Compliance")
- **Provider**: Organization offering the training
- **Pricing**: Cost per participant (if available)

---

## Searching and Filtering Courses

### Search by Keywords

1. **Use the Search Bar**:
   - Type keywords related to the training you need
   - Examples: "safety", "leadership", "Excel", "project management"
   - The search looks through both course titles and descriptions
   - Results update automatically as you type

### Filter by Modality

1. **Click the Modality Dropdown**:
   - **All Modalities**: Show all courses
   - **In Person**: Only classroom-based training
   - **Online**: Only virtual/remote training
   - **Hybrid**: Courses offering both options

2. **Combine Filters**:
   - Use search and modality filter together
   - Example: Search "Excel" + filter "Online" = Online Excel courses

---

## Viewing Course Details

### Step 1: Select a Course

1. Click **"View Details"** on any course card
2. A detailed view opens showing:
   - Full course description
   - Learning objectives
   - Course duration
   - Available training sessions

### Step 2: Review Available Sessions

The **Sessions Tab** displays upcoming training sessions:

- **Date Range**: Start and end dates
- **Time**: Session start and end times
- **Venue**: Location name (for in-person courses)
- **City & Country**: Geographic location
- **Capacity**: Available seats
- **Status**: Whether the session is open for booking

### Session Information Includes:

- 📅 **Dates**: When the training takes place
- ⏰ **Time**: Daily schedule
- 📍 **Location**: Venue details (for in-person training)
- 👥 **Capacity**: Maximum number of participants
- 💺 **Availability**: Seats remaining

---

## Booking a Training Session

### Prerequisites

- You must be logged in
- The session must have available capacity
- The session must be in "open" status

### Booking Process

**Step 1: Find Your Course**
1. Browse or search for the training course you need
2. Click **"View Details"** on the course

**Step 2: Select a Session**
1. Review the **Sessions** tab
2. Check dates, times, and locations
3. Find a session that fits your schedule
4. Click **"Book This Session"** button

**Step 3: Confirm Booking**
1. A confirmation dialog appears showing:
   - Course title
   - Session dates and times
   - Venue location (if in-person)
   - Any important details
2. Review all information carefully
3. Click **"Confirm Booking"** to submit your request

**Step 4: Confirmation**
- A success message appears: "Your booking request has been submitted successfully"
- The booking is created with "pending" status (awaiting approval)
- You can view it in **"My Bookings"** page

### Important Notes

⚠️ **Security Feature**: Your user ID is automatically linked to the booking from your authenticated session. You don't need to provide any personal information - the system knows who you are.

⚠️ **Approval Process**: Most bookings require manager or admin approval before being confirmed.

---

## Managing Your Bookings

### Viewing Your Bookings

**Step 1: Access My Bookings**
1. Click **"My Bookings"** in the sidebar menu
2. Your bookings are organized into two sections:
   - **Active Bookings**: Confirmed or pending bookings
   - **Past Bookings**: Completed or cancelled bookings

### Booking Card Information

Each booking card displays:

- **Course Name**: The training you booked
- **Status Badge**: Current booking status (color-coded)
- **Dates**: Training session dates
- **Time**: Session timing
- **Location**: Venue and city (for in-person)
- **Booking Date**: When you made the booking

### Cancelling a Booking

**When You Can Cancel**:
- Bookings with "pending" or "confirmed" status
- Before the training session starts

**Cancellation Process**:

1. Find the booking you want to cancel
2. Click the **"Cancel Booking"** button (red button with X icon)
3. A confirmation dialog appears asking: "Are you sure you want to cancel this booking?"
4. Click **"Confirm Cancellation"** to proceed
5. Success message: "Booking cancelled successfully"
6. The booking status changes to "cancelled"

⚠️ **Note**: Cancelled bookings move to the "Past Bookings" section and cannot be reinstated. You'll need to create a new booking.

---

## Understanding Booking Statuses

### Status Types

Your bookings can have the following statuses:

1. **Pending** (Gray Badge)
   - Booking has been submitted
   - Awaiting approval from admin/manager
   - You can still cancel at this stage

2. **Confirmed** (Blue/Default Badge)
   - Booking approved and finalized
   - You have a confirmed seat in the training
   - You can still cancel before the session starts

3. **Completed** (Outlined Badge)
   - Training session has finished
   - You attended the course
   - No actions available

4. **Cancelled** (Red Badge)
   - Booking was cancelled (by you or admin)
   - No longer active
   - Appears in "Past Bookings"

### Status Colors Quick Reference

- 🟦 **Blue/Default** = Confirmed
- ⚪ **Gray** = Pending
- 🟥 **Red** = Cancelled
- ⬜ **Outline** = Completed

---

## Admin Functions

### For Administrators Only

If you have admin privileges, you have additional capabilities:

### Managing Training Providers

**Access**: Admin Dashboard → Training Providers

**Functions**:
- View all external training providers
- Add new training providers (name, contact info, website)
- Edit provider information
- Deactivate providers

### Managing Training Venues

**Access**: Admin Dashboard → Training Venues

**Functions**:
- View all training venues
- Add new venues (name, address, city, country, capacity)
- Edit venue details
- Deactivate venues

### Managing Training Courses

**Access**: Admin Dashboard → Training Courses

**Functions**:
- View all external training courses
- Create new courses (title, description, duration, pricing)
- Assign courses to providers
- Set course tags and categories
- Edit course details
- Deactivate courses

### Managing Training Sessions

**Access**: Admin Dashboard → Training Sessions

**Functions**:
- View all scheduled training sessions
- Create new sessions for courses
- Set session dates, times, and venues
- Set capacity limits
- Manage session status (open/closed)
- Cancel or reschedule sessions

### Managing Bookings

**Access**: Admin Dashboard → Course Bookings

**Functions**:
- View all user bookings
- Filter bookings by user, session, or status
- Approve pending bookings
- Confirm or reject booking requests
- Cancel bookings on behalf of users
- View booking history and analytics

### Training Policy Matrix

**Access**: Admin Dashboard → Training Policy Matrix

**Functions**:
- Link required training courses to job roles
- Set mandatory vs optional training
- Define compliance requirements
- Manage training policies by department or role

---

## Common Use Cases

### Scenario 1: Employee Needs Safety Training

1. User logs in to Capera
2. Navigates to **Training Catalog**
3. Searches for "safety training"
4. Filters by **"In Person"** (required for practical assessment)
5. Reviews available courses
6. Selects **"Health & Safety Certification"**
7. Checks **Sessions** tab for convenient dates
8. Finds a session in their city next month
9. Clicks **"Book This Session"**
10. Confirms booking
11. Manager approves booking (status → Confirmed)
12. User attends training
13. Booking status → Completed

### Scenario 2: Remote Worker Seeks Leadership Development

1. User searches **"leadership"**
2. Filters by **"Online"** (works remotely)
3. Finds **"Leadership Essentials"** course
4. Reviews 3-day online format
5. Selects session that fits schedule
6. Books session
7. Receives confirmation
8. Attends virtual training
9. Completes course successfully

### Scenario 3: User Changes Plans

1. User has a confirmed booking
2. Plans change (conflict arises)
3. Goes to **"My Bookings"**
4. Finds the relevant booking
5. Clicks **"Cancel Booking"**
6. Confirms cancellation
7. Booking status → Cancelled
8. Can rebook later if needed

---

## Tips & Best Practices

### For Users

✅ **Book Early**: Popular courses fill up quickly
✅ **Check Requirements**: Review prerequisites and course objectives
✅ **Verify Dates**: Ensure sessions fit your schedule before booking
✅ **Set Reminders**: Note training dates in your calendar
✅ **Plan Ahead**: Book in advance to allow time for approval
✅ **Cancel Properly**: If you can't attend, cancel to free up space for others

### For Administrators

✅ **Regular Updates**: Keep course catalogs current
✅ **Capacity Planning**: Monitor booking trends to plan sessions
✅ **Prompt Approvals**: Review pending bookings quickly
✅ **Provider Management**: Maintain good relationships with training providers
✅ **Analytics**: Track completion rates and popular courses
✅ **Communication**: Notify users of new courses or policy changes

---

## Troubleshooting

### Common Issues

**Problem**: Cannot see the Training Catalog
- **Solution**: Check that you're logged in and have proper permissions

**Problem**: Booking button is disabled
- **Solution**: The session may be full or closed. Check capacity and status

**Problem**: Booking doesn't appear in "My Bookings"
- **Solution**: Refresh the page. If still missing, contact your administrator

**Problem**: Cannot cancel a booking
- **Solution**: Only pending/confirmed bookings can be cancelled. Completed bookings cannot be cancelled

**Problem**: Search returns no results
- **Solution**: 
  - Try broader search terms
  - Remove modality filters
  - Check spelling

---

## Support

### Need Help?

- **Technical Issues**: Contact your IT administrator
- **Booking Questions**: Reach out to your manager or HR department
- **Training Content**: Contact the training provider directly
- **System Features**: Refer to your admin or system owner

### Feature Requests

If you have suggestions for improving the training system, please contact your administrator or submit feedback through your organization's process.

---

## System Benefits

### For Employees

- 🎯 **Easy Discovery**: Find relevant training quickly
- 📅 **Flexible Scheduling**: Choose sessions that fit your calendar
- 💼 **Career Development**: Access professional development opportunities
- 📊 **Track Progress**: View all your training history in one place
- ✅ **Simple Booking**: Book courses in just a few clicks

### For Organizations

- 📈 **Centralized Management**: All external training in one system
- 💰 **Better Planning**: Track training budgets and utilization
- 📋 **Compliance Tracking**: Ensure mandatory training is completed
- 📊 **Analytics**: Understand training needs and effectiveness
- 🔒 **Security**: Role-based access and approval workflows

---

## Version Information

**System**: Capera External Training Management & Booking
**Last Updated**: October 29, 2025
**Critical Fix Applied**: Circular dependency resolved - all endpoints fully operational

---

## Quick Reference Card

### Common Tasks

| Task | Navigation | Action |
|------|-----------|--------|
| Browse Courses | Sidebar → Training Catalog | Search or scroll |
| Book Training | Course Details → Sessions Tab | Click "Book This Session" |
| View Bookings | Sidebar → My Bookings | Review active bookings |
| Cancel Booking | My Bookings → Select Booking | Click "Cancel Booking" |
| Search Courses | Training Catalog → Search Bar | Type keywords |
| Filter Courses | Training Catalog → Modality Dropdown | Select filter |

### Keyboard Shortcuts

(If implemented in future versions)
- `Ctrl/Cmd + K`: Quick search
- `Esc`: Close dialogs
- Tab: Navigate between fields

---

**End of Tutorial**

For the latest updates and features, always refer to the most recent documentation or contact your system administrator.
