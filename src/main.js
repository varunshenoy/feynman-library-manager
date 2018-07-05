const electron = require('electron')
const url = require('url')
const path = require('path')

const {app, BrowserWindow} = electron

let mainWindow

// Listen for app to be ready

app.on('ready', function(){
  // Create new window
  mainWindow = new BrowserWindow({
    'minHeight': 600,
    'minWidth': 1220,
    'height': 600,
    'width': 1220,
    'icon': path.join(__dirname, 'assets/icons/png/64x64.png'),
    "webPreferences":{
      "webSecurity":false
    }
  })

  // Load html into window
  mainWindow.loadURL(url.format({
    pathname: path.join(__dirname, 'mainWindow.html'),
    protocol: 'file:',
    slashes: true
  }))
})
