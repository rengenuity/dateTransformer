#!/usr/bin/env node

const fs = require('fs').promises
const monthNames= ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]


async function loadFile(filePath) {
    try {
        const data = await fs.readFile(filePath, 'utf-8')
        return data
    } catch (err) {
        console.error(`Error reading file from path ${filePath}`, err)
        throw err
    }
}

async function writeToFile(filePath, content) {
    try {
        await fs.writeFile(filePath, content, 'utf-8')
        console.log(`Successfully wrote to ${filePath}`)
    } catch (err) {
        console.error(`Error writing to file ${filePath}`, err)
        throw err
    }
}

function convertPatternToRegex(pattern) {
    // creates a regex instance based on the source pattern argument
    const tokenPatterns = {
        'yyyy': '(?<year4>\\d{4})',
        'yy': '(?<year2>\\d{2})',
        'mm': '(?<month2>\\d{2})',
        'm': '(?<month1>\\d{1,2})',
        'mmm': '(?<monthAbbr>Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)',
        'mmmm': '(?<monthFull>January|February|March|April|May|June|July|August|September|October|November|December)',
        'dd': '(?<day2>\\d{2})(?<dayOrdinal2>st|nd|rd|th)?', 
        'd': '(?<day1>\\d{1,2})(?<dayOrdinal1>st|nd|rd|th)?',
        'ddd': '(?<dayAbbr>Mon|Tue|Wed|Thu|Fri|Sat|Sun)',
        'dddd': '(?<dayFull>Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)'
    }

    const regexPattern = pattern.replace(
        /yyyy|yy|mmmm|mmm|mm|m|dddd|ddd|dd|d/g,
        matchedToken => tokenPatterns[matchedToken]
    )

    return new RegExp(regexPattern, 'g')
}

function convertStringToDate(match) {
    // Extract year, month, and day from dates matching the regex
    let year = match.groups.year4 || match.groups.year2
    if (year.length === 2) {
        year = parseInt(year, 10) < 50 ? '20' + year : '19' + year // Simple 2-digit year heuristic
    }

    let month = match.groups.month2 || match.groups.month1 || match.groups.monthAbbr || match.groups.monthFull
    if (isNaN(month)) { // Month is a string, needs conversion
        month = monthNames.indexOf(month) + 1 // Convert month name to month number
    } else {
        month = parseInt(month, 10)
    }

    const day = parseInt(match.groups.day2 || match.groups.day1, 10)

    return new Date(year, month - 1, day) // month is 0-indexed in Date
}


function convertDateToString(match, date, destinationPattern) {
    // uses the generated regex to find all the matching dates in the ingested file
    const monthNamesAbbr = monthNames.map(name => name.substring(0, 3))
    
    const dayNamesFull = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
    const dayNamesAbbr = dayNamesFull.map(name => name.substring(0, 3))

    const mapping = {
        'yyyy': date.getFullYear(),
        'yy': String(date.getFullYear()).slice(-2),
        'mm': String(date.getMonth() + 1).padStart(2, '0'),
        'm': date.getMonth() + 1,
        'mmm': monthNamesAbbr[date.getMonth()],
        'mmmm': monthNames[date.getMonth()],
        'dd': String(date.getDate()).padStart(2, '0'),
        'd': date.getDate(),
        'ddd': dayNamesAbbr[date.getDay()],
        'dddd': dayNamesFull[date.getDay()]
    }

    return destinationPattern.replace(/yyyy|yy|mmmm|mmm|mm|m|dddd|ddd|dd|d/g, token => mapping[token])
}

function transformDatesInText(inputText, sourcePattern, destinationPattern) {
    // In the real world, this would rely on significantly fewer helpers, as I'd use a library like moment.js
    const sourcePatternRegex = convertPatternToRegex(sourcePattern)
    const patternMatches = [...inputText.matchAll(sourcePatternRegex)]
    const originalDateStrings = patternMatches.map(match => match[0])
    const transformedDateStrings = patternMatches.map((match) => {
        const date = convertStringToDate(match)
        return convertDateToString(match, date, destinationPattern)
    })

    let outputText = inputText
    //loops through the transformed date strings and updates the original text with them
    for (let i = 0; i < transformedDateStrings.length; i++) {
        const originalDateString = originalDateStrings[i]
        const transformedDateString = transformedDateStrings[i]
        outputText = outputText.replace(originalDateString, transformedDateString)
    }

    return outputText
}

async function transformDates(filePath, sourcePattern, destinationPattern) {
    const inputText = await loadFile(filePath)
    outputText = transformDatesInText(inputText, sourcePattern, destinationPattern)
    console.log({inputText, outputText})

    await writeToFile(filePath, outputText)
    return outputText
}

// Code block to let you call the function directly from the command line without requiring the module
if (require.main === module) {  
    const [,, filePath, sourcePattern, destinationPattern] = process.argv;

    if (!filePath || !sourcePattern || !destinationPattern) {
        console.error("Usage: node transformDates <filePath> <sourcePattern> <destinationPattern>");
        process.exit(1);
    }

    if (parseInt(process.version.split('.')[0].replace('v', '')) < 20) {
        console.error("This script requires Node.js version 20 or newer.");
        process.exit(1);
    }

    transformDates(filePath, sourcePattern, destinationPattern).catch(err => {
        console.error("Error transforming dates:", err);
    });
}