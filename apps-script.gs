// InsightRide - Google Sheets Integration Script
// Copy this code into Google Apps Script for Sheets integration

function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    status: "ok",
    message: "InsightRide Google Sheets API is ready"
  })).setMimeType(ContentService.MimeType.JSON);
}

function addTrip(date, time, pickup, dropoff, distance, duration, fare, tips, paymentMethod, passengerName, notes) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Trips");
    const timestamp = new Date();
    
    sheet.appendRow([
      timestamp,
      date,
      time,
      pickup,
      dropoff,
      distance,
      duration,
      fare,
      tips,
      paymentMethod,
      passengerName,
      notes
    ]);
    
    return {
      status: "success",
      message: "Trip added successfully"
    };
  } catch (error) {
    return {
      status: "error",
      message: error.toString()
    };
  }
}

function addExpense(date, category, amount, quantity, description, receipt) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Expenses");
    const timestamp = new Date();
    
    sheet.appendRow([
      timestamp,
      date,
      category,
      amount,
      quantity,
      description,
      receipt
    ]);
    
    return {
      status: "success",
      message: "Expense added successfully"
    };
  } catch (error) {
    return {
      status: "error",
      message: error.toString()
    };
  }
}

function getTrips(startDate, endDate) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Trips");
    const data = sheet.getDataRange().getValues();
    
    const trips = data.slice(1).filter(row => {
      const tripDate = new Date(row[1]);
      return tripDate >= new Date(startDate) && tripDate <= new Date(endDate);
    });
    
    return {
      status: "success",
      data: trips,
      count: trips.length,
      totalFare: trips.reduce((sum, row) => sum + (row[7] || 0), 0),
      totalDistance: trips.reduce((sum, row) => sum + (row[5] || 0), 0),
      totalDuration: trips.reduce((sum, row) => sum + (row[6] || 0), 0)
    };
  } catch (error) {
    return {
      status: "error",
      message: error.toString()
    };
  }
}

function getExpenses(startDate, endDate) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Expenses");
    const data = sheet.getDataRange().getValues();
    
    const expenses = data.slice(1).filter(row => {
      const expenseDate = new Date(row[1]);
      return expenseDate >= new Date(startDate) && expenseDate <= new Date(endDate);
    });
    
    return {
      status: "success",
      data: expenses,
      count: expenses.length,
      totalAmount: expenses.reduce((sum, row) => sum + (row[3] || 0), 0),
      byCategory: expenses.reduce((acc, row) => {
        const cat = row[2];
        acc[cat] = (acc[cat] || 0) + (row[3] || 0);
        return acc;
      }, {})
    };
  } catch (error) {
    return {
      status: "error",
      message: error.toString()
    };
  }
}

function createSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // Create Trips sheet
  const tripsSheet = ss.insertSheet("Trips");
  tripsSheet.appendRow([
    "Timestamp",
    "Date",
    "Time",
    "Pickup Location",
    "Dropoff Location",
    "Distance (km)",
    "Duration (min)",
    "Fare (R)",
    "Tips (R)",
    "Payment Method",
    "Passenger Name",
    "Notes"
  ]);
  
  // Create Expenses sheet
  const expensesSheet = ss.insertSheet("Expenses");
  expensesSheet.appendRow([
    "Timestamp",
    "Date",
    "Category",
    "Amount (R)",
    "Quantity",
    "Description",
    "Receipt URL"
  ]);
  
  // Create Summary sheet
  const summarySheet = ss.insertSheet("Summary");
  summarySheet.appendRow([
    "Metric",
    "Current Month",
    "Last Month",
    "Change"
  ]);
  
  return {
    status: "success",
    message: "Sheets created successfully"
  };
}
