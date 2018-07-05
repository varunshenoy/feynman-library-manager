// import necessary libraries
const jquery = require('jquery')
const JsonDB = require('node-json-db')
const moment = require('moment')
const swal = require('sweetalert2')
const jsPDF = require('jspdf');  require('jspdf-autotable')
const fs = require('fs')

// set up moment.js
moment().format()

// initialize a new database
var db = new JsonDB(__dirname + "/datastores/feynmanDatabase", true, false)

// find and use latest database backup
var latest = db.getData("data_file")["data_file"]
db = new JsonDB(__dirname + "/datastores/" + latest, true, false)
var check_out_patron = {}

// load the books view when the user beings using the app
var currentView = "books"

// utility function to backup the database to a new file
function backupDatabase() {
  // read current database
  fs.readFile(__dirname + "/datastores/" + db.getData("data_file")["data_file"] + ".json",function(err,data) {
      if(err)
        console.log(err)
      else {
        // if there are no errors, create a new database with a date identifier appended to the file name
        var fname = "feynmanDatabase-" + moment().format("MM-DD-YY")
        fs.writeFile(__dirname + "/datastores/" + fname + ".json", data, function(erro) {
          if(erro)
            console.log("error : " + erro)
          else
            console.log("success")

            // update and load the database
            var main_db = new JsonDB(__dirname + "/datastores/feynmanDatabase", true, false)
            main_db.push("/data_file", fname)
            db = new JsonDB(__dirname + "/datastores/" + fname, true, false)
            db.push("/data_file", fname)
            console.log(fname)
        })
      }
  })
}

$(document).ready(function() {

  // prepare the books view for the user
  updateBookTable()

  // backup the database
  backupDatabase()

  // whenever a librarian adds a new book to the database, take in the information from the inputs and add it to the database
  $(".add-book-to-db").click(function() {

    // load json branches from the database
    var next_id = db.getData("/next-id")
    var data = db.getData("/books")

    if ($(".new-book-title").val().replace(' ', '') === "" || $(".new-book-author").val().replace(' ', '') === "" || $(".new-book-id").val().replace(' ', '') === ""
    || $(".new-book-isbn").val().replace(' ', '') === "") {
      swal('Error!', 'A text field was left blank!', 'error')
    } else {
      // add data to the database
      data.push({"title": $(".new-book-title").val(), "author": $(".new-book-author").val(), "id": $(".new-book-id").val(), "isbn": $(".new-book-isbn").val(), "checked_out": "-", "return_date": "-"})

      // empty data fields
      $(".new-book-title").val("")
      $(".new-book-author").val("")
      $(".new-book-id").val("")
      $(".new-book-isbn").val("")

      // update books branch
      db.push("/books", data)

      // increment ID for next book
      db.push("/next-id", next_id + 1)
      backupDatabase()
      updateBookTable()
    }
  })

  // whenever a librarian adds a new patron to the database, take in the information from the inputs and add it to the database
  $(".add-patron-to-db").click(function() {
    // load json branches from the database
    var data = db.getData("/patrons")

    if ($(".new-patron-fn").val().replace(' ', '') === "" || $(".new-patron-ln").val().replace(' ', '') === "" || $(".new-patron-id").val().replace(' ', '') === "") {
      swal('Error!', 'A text field was left blank!', 'error')
    } else {
      // read radio button selection
      var gradelevel_radio = $("input:radio[name ='grade-level']:checked").val()

      // add data to the database
      data.push({ "first_name": $(".new-patron-fn").val(), "last_name": $(".new-patron-ln").val(), "id": $(".new-patron-id").val(), "grade": gradelevel_radio, "books": []})

      // empty data fields
      $(".new-patron-ln").val("")
      $(".new-patron-fn").val("")
      $(".new-patron-id").val("")

      // update patrons branch
      db.push("/patrons", data)
      backupDatabase()
      updatePatronTable()
    }
  })

  // show modal for check in and check out on button click on the menu
  $(".check-out-trigger").click(function() {
    $('.check-out-modal').modal('show')
  })

  $(".check-in-trigger").click(function() {
    $('.check-in-modal').modal('show')
  })

  // check out a book to a patron
  $(".check-out-finished").click(function() {

    // dynamic search field for patrons
    check_out_patron = $('.patron-filter-search').search('get result')

    // grab data from branches
    var patrons = db.getData("/patrons")
    var books = db.getData("/books")

    // gather information about book and patron
    var patronID = check_out_patron.id
    var bookID = $(".check-out-id").val()

    if (bookID.replace(' ', '') === "") {
      swal('Error!', 'A text field was left blank!', 'error')
    } else {
      // safety check to ensure that the patron can check another book out
      var shouldReturn = false
      var matchFound = false
      if (check_out_patron.grade === "Teacher/Staff" && check_out_patron.numChecked == 15) {
        swal('Error!', 'Maximum number of books already checked out for a teacher (15)!', 'error')
        return
      }
      if (check_out_patron.numChecked == 5) {
        swal('Error!', 'Maximum number of books already checked out for a student (5)!', 'error')
        return
      }

      // make sure that book has not been checked out
      books.forEach(function(element, index) {
        if (element.id === bookID) {
          if (element.return_date != "-") {
            swal('Error!', 'Book has already been checked out to another patron!', 'error')
            shouldReturn = true
          } else {

            // check out a book for a patron
            books[index].checked_out = patronID
            if (check_out_patron.grade === "Teacher/Staff") {

              // teachers can check out a book for 42 days
              books[index].return_date = moment().add(42, 'days').calendar()
            } else {

              // students can check out a book for 21 days
              books[index].return_date = moment().add(21, 'days').calendar()
            }
            matchFound = true
          }
        }
      })
      if (shouldReturn) {
        return
      }
      if (!matchFound) {
        swal('Error!', 'Book with given ID does not exist!', 'error')
        return
      }

      // update the database to reflect changes
      db.push("/books", books)
      patrons.forEach(function(element, index) {
        if (element.id === patronID) {
          patrons[index].books.push($(".check-out-id").val())
        }
      })

      // add book to patron's list
      db.push("/patrons", patrons)
      backupDatabase()
      updateCurrentView()
    }
  })

  // check in a patron's book
  $(".check-in-finished").click(function() {

    // gather data from branches of database
    var patrons = db.getData("/patrons")
    var books = db.getData("/books")
    var myBook = {}
    var myBookIndex = 0

    // get ID of returned book
    var bookID = $(".check-in-id").val()

    if (bookID.replace(' ', '') === "") {
      swal('Error!', 'A text field was left blank!', 'error')
    } else {
      // find book being returned
      books.forEach(function(element, index) {
        if (element.id === bookID) {
          myBook = element
          myBookIndex = index
        }
      })

      if (Object.keys(myBook).length === 0) {
        swal('Error!', 'Book with given ID does not exist!', 'error')
      } else {
        // check in book
        var patronID = myBook.checked_out
        myBook.checked_out = "-"
        myBook.return_date = "-"
        books[myBookIndex] = myBook
        db.push("/books", books)

        // find patron with the book
        var myPatron = {}
        var myPatronIndex = 0
        patrons.forEach(function(element, index) {
          if (element.id === patronID) {
            myPatron = element
            myPatronIndex = index
          }
        })

        // remove book from patron's list
        myPatron.books = myPatron.books.filter(e => e !== bookID)
        patrons[myPatronIndex] = myPatron
        db.push("/patrons", patrons)

        backupDatabase()
        updateCurrentView()
      }
    }
  })

  // show interactive Q&A menu
  $(".faq-trigger").click(function() {
    $('.faq-modal').modal('show')
    $('.ui.accordion').accordion()
  })

  // load the selector for Files
  function loadDatabaseFileSelector() {
    var selector = $('.data-selector')
    selector.empty()
    fs.readdir(__dirname + '/datastores/', "ascii", (err, files) => {
      files.forEach(file => {
        if (file !== 'feynmanDatabase.json') {
          file = file.replace('.json', '')
          if (file === db.getData("data_file")["data_file"]) {
            $('.data-selector').append('<option value="' + file + '">' + file + ' (current)</option>')
          } else {
            $('.data-selector').append('<option value="' + file + '">' + file + '</option>')
          }
        }
      });
    })
  }

  // show database management menu
  $("#database-management").click(function() {
    $('.data-management-modal').modal('show')
    loadDatabaseFileSelector()
  })

  $(".load-backup").click(function() {
    var fname = $('.data-selector').find('option:selected').attr("value");
    var main_db = new JsonDB(__dirname + "/datastores/feynmanDatabase", true, false)
    main_db.push("/data_file", fname)
    db = new JsonDB(__dirname + "/datastores/" + fname, true, false)
    updateCurrentView()
    loadDatabaseFileSelector()
    swal('Updated!', 'Loading backup was successful!', 'success')
  })

  // update the header and table for the patron view
  $("#patron-management").click(function() {
    currentView = "patrons"
    var header_insert = `<i class="users icon"></i>
    <div class="content">
      Patron Management
      <div class="sub header">Add, Remove, Update, and Find Information about Patrons</div>
    </div>`
    $("#text-header").empty()
    $("#text-header").append(header_insert)
    $("#data-table").empty()
    updatePatronTable()
  })

  // update the header and table for the book view
  $("#book-management").click(function() {
    currentView = "books"
    var header_insert = `<i class="book icon"></i>
    <div class="content">
      Book Management
      <div class="sub header">Add, Remove, Update, and Find Information about Books</div>
    </div>`

    $("#text-header").empty()
    $("#text-header").append(header_insert)
    updateBookTable()

  })

  // update the header and table for the overdue view
  $("#overdue-books").click(function() {
    currentView = "overdue"
    var header_insert = `<i class="history icon"></i>
    <div class="content">
      Overdue Books
      <div class="sub header">Manage Overdue Books and Print Late Fine Receipts</div>
    </div>`
    $("#text-header").empty()
    $("#text-header").append(header_insert)
    $("#data-table").empty()
    updateOverdueTable()
  })

  // selection highlighting on menu in application
  $('.ui .item').on('click', function() {
     $('.ui .item').removeClass('active')
     $(this).addClass('active')
  })

  // trigger new patron modal to add new patrons
  $(".add-new-patron").on('click', function() {
    $('.ui.radio.checkbox').checkbox()
    $('.add-patron-modal').modal('show')
  })

})

// trigger new patron modal to add new patrons from patron view
$(document).on("click", ".add-patron", function() {
  $('.ui.radio.checkbox').checkbox()
  $('.add-patron-modal').modal('show')

})

// trigger new book modal to add new books from book view
$(document).on("click", ".add-book", function() {
  var next_id = db.getData("/next-id")

  // generate padded id for book
  var padded_id = pad(next_id, 8)
  $(".new-book-id").val(padded_id)
  $('.add-book-modal').modal('show')
})

// generate weekly book report
$(document).on("click", "#print-weekly-report", function() {

  // select data branch for books
  var data = db.getData("/books")

  // set up columns and rows for books
  var columns = ["Book Name", "Book ID", "Patron Name", "Patron ID", "Days Until Due"]
  var rows = []
  data.forEach(function(element, index) {

    // gather data about each book
    var name = "-"
    var days_left = "-"
    var isOverdue = false
    if (element.checked_out != "-") {
      var user = findUserByID(element.checked_out)
      name = findUserByID(element.checked_out).first_name + " " + findUserByID(element.checked_out).last_name
      var return_date = moment(element.return_date, "MM-DD-YYYY")
      var now = moment()
      days_left = Math.abs(now.diff(return_date, 'days'))
      if (isLate(element.return_date)) {
        isOverdue = true
      }
    }
    if (isOverdue) {
      rows.push([element.title, element.id, name, element.checked_out, "Overdue by " + days_left])
    } else {
      rows.push([element.title, element.id, name, element.checked_out, days_left])
    }
  })

  // generate book report using jsPDF and tables
  var doc = new jsPDF('p', 'pt')
  doc.text('Weekly Report for Feynman High School', 150, 25)
  doc.autoTable(columns, rows)
  doc.save('weekly-report.pdf')
  swal('Success!', 'Navigate to your saved PDF and print it out using a PDF reader or send it to co-workers!', 'success')
})

// generate overdue report
$(document).on("click", "#print-overdue-report", function() {

  // select data branch for books
  var data = db.getData("/books")

  // set up columns and rows for books
  var columns = ["Book Name", "Author", "Book ID", "Patron Name", "Patron ID", "Days Overdue", "Current Fine"]
  var rows = []
  data.forEach(function(element, index) {

    // gather data about each book
    var name = "-"
    if (element.checked_out != "-") {
      var user = findUserByID(element.checked_out)
      name = findUserByID(element.checked_out).first_name + " " + findUserByID(element.checked_out).last_name
      var return_date = moment(element.return_date, "MM-DD-YYYY")
      var now = moment()
      var days_left = now.diff(return_date, 'days')
      var fine = (days_left * 0.15).toFixed(2)
      if (isLate(element.return_date)) {
        rows.push([element.title, element.author, element.id, name, element.checked_out, days_left, '$' + fine])
      }
    }
  })

  // generate book report using jsPDF and tables
  var doc = new jsPDF('p', 'pt')
  doc.text('Overdue Report for Feynman High School', 150, 25)
  doc.autoTable(columns, rows, {
        headerStyles: {
            fillColor: [230, 126, 64]
        }
      })
  doc.save('overdue-report.pdf')
  swal('Success!', 'Navigate to your saved PDF and print it out using a PDF reader or send it to co-workers!', 'success')
})

// use filtering for search bar and table in every table based view
$(document).on("keyup", "#search-filter", function() {
  var $rows = $('tbody tr')
  $('#search-filter').keyup(function() {
      var val = $.trim($(this).val()).replace(/ +/g, ' ').toLowerCase()

      $rows.show().filter(function() {
          var text = $(this).text().replace(/\s+/g, ' ').toLowerCase()
          return !~text.indexOf(val)
      }).hide()
  })
})

// search for patrons when checking a book out
$(document).on("keyup", "#patron-filter", function() {
  var patrons =  db.getData("/patrons")
  var content = []
  patrons.forEach(function(element, index) {
    content.push({"title": element.first_name + " " + element.last_name, "description": element.id + " - " + element.grade, "id": element.id, "grade": element.grade})
  })
  $('.patron-filter-search')
    .search({
      source : content,
      searchFields   : [
        'title',
        'description'
      ]
    })

  check_out_patron = $('.patron-filter-search').search('get result')
})

// update the book table in the book view
function updateBookTable() {

  // get data from books branch
  var data = db.getData("/books")

  // empty current table
  $("#data-table").empty()

  // basic html for header row of table
  var table_insert = `<thead>
    <tr>
      <th>Book Name</th>
      <th>Author</th>
      <th>Book ID</th>
      <th>ISBN</th>
      <th>Checked Out By</th>
      <th>Return Date</th>
    </tr>
  </thead>
  <tbody class="books-table">
  </tbody>`

  $("#data-table").append(table_insert)

  $("#main-buttons").empty()

  var button_insert = `<button class="ui basic button right floated" id="print-weekly-report">
    <i class="icon print"></i>
    Print Weekly Report
  </button>
  <button class="ui basic button right floated add-book">
    <i class="icon add"></i>
    Add Book
  </button>`

  $("#main-buttons").append(button_insert)

  // iterate over every book
  data.forEach(function(element, index) {
    var name = "-"
    var negative_row = ""
    if (element.checked_out != "-") {
      var user = findUserByID(element.checked_out)
      name = findUserByID(element.checked_out).first_name + " " + findUserByID(element.checked_out).last_name

      // highlight row with a light red color if the book is overdue
      if (isLate(element.return_date)) {
        negative_row = "negative"
      }
    }

    // fill out book table with every book
    $(".books-table").append("<tr class='" + negative_row + "'><td>" + element.title + "</td><td>" + element.author + "</td><td>" + element.id + "</td><td>" + element.isbn+ "</td><td>" + name + "</td><td>" + element.return_date + "</td></tr>")
  })
}

// update the patron table in the patron view
function updatePatronTable() {

  // get data from patrons branch
  var data = db.getData("/patrons")

  // empty current table
  $("#data-table").empty()

  // basic html for header row of table
  var table_insert = `<thead>
    <tr>
      <th>Actions</th>
      <th>First Name</th>
      <th>Last Name</th>
      <th>Staff/Student ID</th>
      <th>Grade (Max. Books)</th>
      <th># Books Checked Out</th>
    </tr>
  </thead>
  <tbody class="patron-table">
  </tbody>`

  $("#data-table").append(table_insert)
  $("#main-buttons").empty()

  var button_insert = `<button class="ui basic button right floated add-patron">
    <i class="icon add"></i>
    Add Patron
  </button>`

  $("#main-buttons").append(button_insert)

  // iterate over every patron
  data.forEach(function(element, index) {
    var maxBooks = 5
    var currentBooks = element.books.length
    if (element.grade === "Teacher/Staff") {
      var maxBooks = 15
    }

    var trow = $("<tr><center><td><button class='ui teal icon button' id='" + element.id + "'><i class='edit icon'></i></button></td></center><td>" + element.first_name + "</td><td>" + element.last_name + "</td><td>" + element.id + "</td><td>" + element.grade + " ("+ maxBooks+ " books max.) </td><td>" + currentBooks
    + "</td></tr>")

    // add function to edit name action in every table row
    $(trow).on('click', function() {
      updatePatronInfo(element.id, element.first_name, element.last_name)
    })
    $(".patron-table").append(trow)
  })
}

var selectedUserID = ""

function updatePatronInfo(userID, first_name, last_name) {

  // prefill text field using patron's first and last name
  selectedUserID = userID
  $('.update-patron-modal').modal('show')
  $('.update-fn').val(first_name)
  $('.update-ln').val(last_name)
}

// edit a patron's name
$(document).on("click", ".update-patron-button", function() {

  // get data from patrons branch
  var patrons =  db.getData("/patrons")
  var content = []

  // get patron and new information
  patrons.forEach(function(element, index) {
    if (element.id == selectedUserID) {
      element["first_name"] = $('.update-fn').val()
      element["last_name"] = $('.update-ln').val()
    }
  })

  // update database to reflect name edits
  db.push("/patrons", patrons)

  backupDatabase()
  updateCurrentView()

})

function updateOverdueTable() {

  // get data from books branch
  var data = db.getData("/books")

  // empty current table
  $("#data-table").empty()

  // basic html for header row of table
  var table_insert = `<thead>
    <tr>
      <th>Actions</th>
      <th>Book Name</th>
      <th>Author</th>
      <th>Book ID</th>
      <th>Accumulated Fines</th>
      <th>Checked Out By</th>
      <th>Days Overdue</th>
    </tr>
  </thead>
  <tbody class="overdue-table">
  </tbody>`

  $("#data-table").append(table_insert)

  $("#main-buttons").empty()

  var button_insert = `<button class="ui basic button right floated" id="print-overdue-report">
    <i class="icon print"></i>
    Print All Fines Report
  </button>
  </button>`

  $("#main-buttons").append(button_insert)

  // iterate over every book
  data.forEach(function(element, index) {
    var name = "-"
    if (element.checked_out != "-") {
      // if a book is checked out AND it is late, calculate the fine and display it in the row
      var user = findUserByID(element.checked_out)
      name = findUserByID(element.checked_out).first_name + " " + findUserByID(element.checked_out).last_name
      if (isLate(element.return_date)) {
        console.log(element.return_date)
        var return_date = moment(element.return_date, "MM-DD-YYYY")
        var now = moment()
        console.log(return_date)
        var days_left = now.diff(return_date, 'days')
        var fine = (days_left * 0.15).toFixed(2)
        if (fine > 10) {
          fine = 10
        }
        console.log(element.id)

        // display overdue book in the row
        var trow = $("<tr><center><td><button class='ui violet icon button print-fine' id='" + element.id + "'><i class='print icon'></i></button></td></center><td>" + element.title + "</td><td>" + element.author + "</td><td>" + element.id + "</td><td>$" + fine + "</td><td>" + name + "</td><td>" + days_left + "</td></tr>")

        // connect print action button to a report generation method
        $(trow).on('click', function() {
          printBookFines(element.id, element.title, name, fine, element.checked_out)
        })
        $(".overdue-table").append(trow)
      }
    }

  })
}

function printBookFines(book_id, book_title, name, fine, student_id) {

  // use jsPDF module to generate a late receipt
  var doc = new jsPDF()
  doc.text("Bill for Missing Library Book", 70, 30)
  doc.text(name + ' (Student ID: ' + student_id + ')', 10, 50)
  doc.text("Title: " + book_title, 10, 70)
  doc.text("Book ID: " + book_id, 10, 90)
  doc.text("Fine: $" + fine, 10, 110)
  doc.text("", 10, 130)
  doc.text("Please return your book by tomorrow. Your fine increases by 15¢ every day.", 10, 150)
  doc.save(findUserByID(student_id).first_name + "-" + findUserByID(student_id).last_name + "-" + book_id + '-late-fine.pdf')
  swal('Success!', 'Navigate to your saved PDF and print it out using a PDF reader or send it to co-workers/students!', 'success')
}

// convenience method to update the current view after changes
function updateCurrentView() {
  if (currentView === "books") {
    updateBookTable()
  } else if (currentView === "patrons") {
    updatePatronTable()
  } else if (currentView === "overdue") {
    updateOverdueTable()
  }
}

// padding convenience function for book ID generation
function pad(n, width, z) {
  z = z || '0'
  n = n + ''
  return n.length >= width ? n : new Array(width - n.length + 1).join(z) + n
}

// use simple date comparison to see if a book is late
function isLate(date) {
  var date_obj = moment(date, "MM-DD-YYYY")
  var now = moment()
  if (now > date_obj) {
     // date is past
     return true
  } else {
     // date is future
     return false
  }
}

// find a patron from their ID
function findUserByID(id) {
  var patrons = db.getData("/patrons")
  var found = "-"
  patrons.forEach(function(element, index) {
    if (element.id === id) {
      found = element
    }
  })
  return found
}

// find a book from the ID
function findBookByID(id) {
  var books = db.getData("/books")
  books.forEach(function(element, index) {
    if (element.id === id) {
      return element
    }
  })
}
