/* eslint-disable no-console */
const fs = require('fs-extra');
const path = require('path');
const { parse } = require('json2csv');
const Mustache = require('mustache');
const axeIssuesList = require('./constants/axeTypes.json');
const wcagList = require('./constants/wcagLinks.json');
const { allIssueFileName, impactOrder, maxHTMLdisplay } = require('./constants/constants');
const { getCurrentTime, getStoragePath } = require('./utils');

/* There's likely a good reason not to do this */
global.wcagCounts = [];
global.wcagIDsum = [];
global.orderCount = [];
global.id = 0;
global.criticalCount = 0;
global.seriousCount = 0;
global.moderateCount = 0;
global.minorCount = 0;
global.unknownCount = 0;

const extractFileNames = async directory => {
  const allFiles = await fs
    .readdir(directory)
    .catch(readdirError => console.log('Error reading file', readdirError));
  return allFiles.filter(file => path.extname(file).toLowerCase() === '.json');
};

const parseContentToJson = async rPath => {
  const content = await fs
    .readFile(rPath, 'utf8')
    .catch(parseError => console.log('Error parsing JSON string', parseError));
  return JSON.parse(content);
};

const fetchIcons = async (disabilities, impact) => {
  return Promise.all(
    disabilities.map(async disability => {
      const template = await fs
        .readFile(path.join(__dirname, `/static/${disability}.mustache`), 'utf8')
        .catch(iconError => console.log('Error fetching icon', iconError));
      return Mustache.render(template, { impact });
    }),
  ).catch(iconError => console.log('Error fetching all icons', iconError));
};

/* Compile final JSON results */
const writeResults = async (allissues, storagePath) => {

  /* Copy without reference to allissues array */
  var shortAllIssuesJSON = []
  try {
    JSON.parse(JSON.stringify(allissues));
    shortAllIssuesJSON = JSON.parse(JSON.stringify(allissues));
  } catch (e) {
    console.log(allissues);
  }

  console.log("Writing JSON countURLsCrawled " + countURLsCrawled + " and " + allissues.length + " errors found.");

  /* Delete SVG images in copy of allissues */
  for (let i in shortAllIssuesJSON) {
   delete shortAllIssuesJSON[i].disabilityIcons;
  }

  /* Store the information about issue order totals (critical, serious, ...) */
  orderCount = [criticalCount, seriousCount, moderateCount, minorCount, unknownCount];

  /* Count the instances of each WCAG error in wcagIDsum and express that in wcagCounts which gets stored  */
  // wcagIDsum.forEach(function (x) { wcagCounts[x] = (wcagCounts[x] || 0) + 1; });

    /* add information about environment to array. */
    if (wappalyzer_json != null) {
      var wappalyzer_array = ''
      try {
        JSON.parse(wappalyzer_json);
        wappalyzer_array = JSON.parse(wappalyzer_json);
      } catch (e) {
        console.log(wappalyzer_json);
      }

      let x = 0
      var wappalyzer_short = [];

      if (wappalyzer_array['technologies']) {
        while (x < wappalyzer_array['technologies'].length) {
          if (wappalyzer_array['technologies'][x].version == null) {
            wappalyzer_short.push(wappalyzer_array['technologies'][x].name)
          } else {
            wappalyzer_short.push(wappalyzer_array['technologies'][x].name + " (" + wappalyzer_array['technologies'][x].version + ")")
          }
          x++
        }
      }
    }

  const finalResultsInJson = JSON.stringify(
    { startTime: getCurrentTime(), count: allissues.length, domain: domainURL, countURLsCrawled, totalTime, orderCount, wcagCounts, wappalyzer_short, shortAllIssuesJSON },
    null,
    4,
  );
  await fs
    .writeFile(`${storagePath}/reports/compiledResults.json`, finalResultsInJson)
    .catch(writeResultsError => console.log('Error writing to file', writeResultsError));
};

/* Write HTML from JSON to Mustache for whole page content */
const writeHTML = async (allissues, storagePath) => {

  // Sort by impact order (critical, serious, moderate, minor, unknown)
  allissues.sort(function (a, b) {
    return b.order - a.order || b.errorCount - a.errorCount;
  });

  // Replace array of disabilities for string of disabilities for HTML
  var sentenceCountMax = fleschKincaidGradeMax = automatedReadabilityMax = difficultWordsMax = 0;
  for (let i in allissues) {
    if(allissues[i].disabilities != undefined) {
      allissues[i].disabilities = allissues[i].disabilities.toString().replace(/,/g, ' ').toLowerCase();
    } else {
      allissues[i].disabilities = "";
    }
    if (sentenceCountMax == 0 || allissues[i].sentenceCount > sentenceCountMax ) {
      sentenceCountMax = allissues[i].sentenceCount;
      var sentenceCountMaxText = "Most sentences on page: " + allissues[i].sentenceCount + " - " + allissues[i].page;
    }
    if (fleschKincaidGradeMax == 0 || allissues[i].fleschKincaidGrade > fleschKincaidGradeMax ) {
      fleschKincaidGradeMax = allissues[i].fleschKincaidGrade;
      var fleschKincaidGradeMaxText = "Worst Flesch Kincaid score: " + allissues[i].fleschKincaidGrade + " - " + allissues[i].page;
    }
    /* Probably best to jsut stick to Flesch Kincaid
    if (automatedReadabilityMax == 0 || allissues[i].automatedReadabilityIndex > automatedReadabilityMax ) {
      automatedReadabilityMax = allissues[i].automatedReadabilityIndex;
      automatedReadabilityMaxText = "Worst Automated Readability score: " + allissues[i].automatedReadabilityIndex + " - " + allissues[i].page;
    }
    */
    if (difficultWordsMax == 0 || allissues[i].difficultWords > difficultWordsMax ) {
      difficultWordsMax = allissues[i].difficultWords;
      var difficultWordsMaxText = "Most difficult words: " + allissues[i].difficultWords + " - " + allissues[i].page;
    }
  }

/*
  I should be able to do the average score, with seomething like:
     var sentenceCountAverage = (sentenceCountTotal/countURLsCrawled);
  However this function hits errors, not pages, so it would be inflated
    var difficultWordsAverage = (difficultWordsTotal/countURLsCrawled);
  The URLsCrawled may also be inflated as some pages may be skipped or duplicated.
    var fleschKincaidGradeAverage = (fleschKincaidGradeTotal/countURLsCrawled);
*/

  console.log("Writing results to ./reports/allissues.csv");
  const ObjectsToCsv_a = require('objects-to-csv');
  (async () => {
    const csv_a = new ObjectsToCsv_a(allissues);

    // Save to file:
    await csv_a.toDisk(storagePath + "/reports/allissues.csv");
    console.log(await csv_c.toString());
  })();

  console.log("Writing results to ./reports/count.csv");
  const ObjectsToCsv_c = require('objects-to-csv');
  (async () => {
    let count_array = [{level: 'minor', count: minorCount }, {level: 'moderate', count: moderateCount }, {level: 'serious', count: seriousCount }, {level: 'critical', count: criticalCount }, {level: 'countURLs', count: countURLsCrawled }];
    const csv_c = new ObjectsToCsv_c(count_array);

    // Save to file:
    await csv_c.toDisk(storagePath + "/reports/count.csv");
    // console.log(await csv_c.toString());
  })();

  console.log("Writing HTML");

  /* Grading evaluations - */
  if (countURLsCrawled > 25) {
  var grade = message = "";
  var score = (minorCount + (moderateCount * 1.5) + (seriousCount * 2) + (criticalCount * 3)) / (countURLsCrawled * 5);
  console.log("score (minor) + moderate*1.5 + serious*2 + critical*3 / urls*5 = " + score);


  // Scoring for grade
  // Score number = score (minor) + moderate*1.5 + serious*2 + critical*3 / urls*5
  // A+ = 0 ; A <= 0.1 ; A- <= 0.3 ; B+ <= 0.5 ; B <= 0.7 ; B- <= 0.9 ; C+ <= 2 ;
  // C <= 4 C- <= 6 ; D+ <= 8 ; D <= 10 ; D- <= 13 ; F+ <= 15 ; F <= 20 ; F- >= 20
  switch (true) {
    case score == 0:
        grade = "A+";
        message = "No axe errors, great! Don't forget manual testing."
        break;
    case score <= 0.1:
        grade = "A";
        message = "Very few axe errors left! Don't forget manual testing."
        break;
    case score <= 0.3:
        grade = "A-";
        message = "So close to getting the automated errors! Don't forget manual testing."
        break;
    case score <= 0.5:
        grade = "B+";
        message = "More work to eliminate automated testing errors. Don't forget manual testing."
        break;
    case score <= 0.7:
        grade = "B";
        message = "More work to eliminate automated testing errors. Don't forget manual testing."
        break;
    case score <= 0.9:
        grade = "B-";
        message = "More work to eliminate automated testing errors. Don't forget manual testing."
        break;
    case score <= 2:
        grade = "C+";
        message = "More work to eliminate automated testing errors. Don't forget manual testing."
        break;
    case score <= 4:
        grade = "C";
        message = "More work to eliminate automated testing errors. Don't forget manual testing."
        break;
    case score <= 6:
        grade = "C-";
        message = "More work to eliminate automated testing errors. Don't forget manual testing."
        break;
    case score <= 8:
        grade = "D+";
        message = "More work to eliminate automated testing errors. Don't forget manual testing."
        break;
    case score <= 10:
         grade = "D";
         message = "More work to eliminate automated testing errors. Don't forget manual testing."
        break;
    case score <= 13:
        grade = "D-";
        message = "More work to eliminate automated testing errors. Don't forget manual testing."
        break;
    case score <= 15:
        grade = "F+";
        message = "More work to eliminate automated testing errors. Don't forget manual testing."
        break;
    case score <= 20:
        grade = "F";
        message = "More work to eliminate automated testing errors. Don't forget manual testing."
        break;
    default:
        grade = "F-";
        message = "More work to eliminate automated testing errors. Don't forget manual testing."
    }
  } else {
    grade = "?";
    message = "Not enough URLs to evaluate grade. Perhaps there was an error in the scan.";
  }

  // TODO - Document what this is doing.
  // console.log(wcagCounts)
  var wcagCountsContent = '';
  var wcagCountsArray = [];
  var wcagCountsArray2 = [];
  for (let ii in wcagCounts) {
    if(wcagCounts[ii].includes(",")) {
      let wcagCountsSplit = wcagCounts[ii].split(",");
      for (let iii in wcagCountsSplit) {
        wcagCountsArray.push(wcagCountsSplit[iii]);
      }
    } else {
      wcagCountsArray.push(wcagCounts[ii]);
    }
  }

  // Count the instances of each WCAG error in wcagIDsum and express that in wcagCounts which gets stored
  wcagCountsArray.forEach(function (x) { wcagCountsArray[x] = (wcagCountsArray[x] || 0) + 1; });
  var finalWCAGstring = '';
  // var finalWCAGobj = [scanType: wcag, errors: {} ];
  const finalWCAGarray = [];
  let ii = wcagCountsTemp = 0;
  for (let i in wcagCountsArray) {
    if (typeof wcagCountsArray[i] !== 'function') {
    if (typeof wcagCountsArray[i] == "number") {
      wcagCountsTemp = wcagCountsArray[i];
      wcagCountsContent += "" + i + ": " + wcagCountsTemp + ", ";
      let finalWCAGarrayTemp = {wcag: i, count: wcagCountsTemp};
      finalWCAGarray.push(finalWCAGarrayTemp);
      ++ii
      if (ii == 1) {
        wcagCountsContent = "WCAG Errors - " + wcagCountsContent;
      }
    }
    }
  }
// console.log(wcagCountsContent);
// console.log(typeof finalWCAGarray + " " + finalWCAGarray);

console.log("Writing results to ./reports/wcagErrors.csv");
const ObjectsToCsv_wc = require('objects-to-csv');
(async () => {
  // finalWCAGarray.unshift("WCAG Errors", "Count")
  const csv_wc = new ObjectsToCsv_wc(finalWCAGarray);
  // Save to file:
  await csv_wc.toDisk(storagePath + "/reports/wcagErrors.csv");
  // console.log(await csv_wc.toString());
})();

  if (allissues.length > maxHTMLdisplay) allissues.length = maxHTMLdisplay;

    /* add information about environment if possible. */
    if (wappalyzer_json != null) {
      var wappalyzer_array = ''
      try {
        JSON.parse(wappalyzer_json);
        wappalyzer_array = JSON.parse(wappalyzer_json);
      } catch (e) {
        console.log(wappalyzer_json);
      }

      /* Define string of libraries used. */
      let x = 0
      if (wappalyzer_array['technologies']) {
        var wappalyzer_string = "Built with: "
        while (x < wappalyzer_array['technologies'].length) {
          if(wappalyzer_string != "Built with: ") {
            wappalyzer_string += ", "
          }
          if (wappalyzer_array['technologies'][x].version == null) {
            wappalyzer_string += wappalyzer_array['technologies'][x].name
          } else {
            wappalyzer_string += wappalyzer_array['technologies'][x].name + " (" + wappalyzer_array['technologies'][x].version + ")"
          }
          x++
        }
      }

      console.log("Writing results to ./reports/wappalyzer.csv");
      const ObjectsToCsv_wa = require('objects-to-csv');
      (async () => {
        const csv_wa = new ObjectsToCsv_wa(wappalyzer_array['technologies']);

        // Save to file:
        await csv_wa.toDisk(storagePath + "/reports/wappalyzer.csv");
        // console.log(await csv_wa.toString());
      })();

    }

  const finalResultsInJson = JSON.stringify(
    { startTime: getCurrentTime(), count: id, htmlCount: allissues.length,
      domain: domainURL, countURLsCrawled, totalTime, criticalCount, seriousCount,
              moderateCount, minorCount, unknownCount, wcagCounts, grade, message,
              wappalyzer_string, wcagCountsContent, sentenceCountMaxText,
              fleschKincaidGradeMaxText, difficultWordsMaxText, allissues
    },
    null,
    4,
  );
  const musTemp = await fs
    .readFile(path.join(__dirname, '/static/report.mustache'))
    .catch(templateError => console.log('Error fetching template', templateError));
  const output = Mustache.render(musTemp.toString(), JSON.parse(finalResultsInJson));

  // Test both the read and write permissions
  var reportPath = storagePath + "/reports/report.html"
  fs.access(storagePath, (err) => {
    console.log(`${err ? 'Directory does not exist' : ''}`);
  });

  await new Promise(resolve => setTimeout(resolve, 1000));
  await fs.writeFile(reportPath, output);
};

const flattenAxeResults = async rPath => {
  const parsedContent = await parseContentToJson(rPath);
  // var sentenceCountTotal = difficultWordsTotal = fleschKincaidGradeTotal = 0;

  if ( typeof parsedContent.readability !== 'undefined' && parsedContent.readability ) {
    var sentenceCount = parsedContent.readability.sentenceCount;
    var fleschKincaidGrade = parsedContent.readability.fleschKincaidGrade;
    var automatedReadabilityIndex = parsedContent.readability.automatedReadabilityIndex;
    var difficultWords = parsedContent.readability.difficultWords;
  }

  const flattenedIssues = [];
  const { url, page, errors } = parsedContent;
  errors.forEach(error => {

    /* pull out file extension from path */
    var fileExtension = '';
    if (page.includes(".") && !page.includes("@")) {
       fileExtension = page.split('.').pop();
       fileExtension = fileExtension.substring(0, fileExtension.indexOf('?'));
       fileExtension = fileExtension.substring(0, fileExtension.indexOf('#'));
       // fileExtension = limit(fileExtension, 6);
    }

    error.fixes.forEach(item => {
      const { id: errorId, impact, description, helpUrl } = error;
      const { disabilityIcons, disabilities, wcag } = axeIssuesList.find(obj => obj.id === errorId) || {};

      ++id;

        /* Get string from wcagID */
        var wcagID = '';
        try {
          JSON.parse(JSON.stringify(wcag).toString());
          wcagID = JSON.parse(JSON.stringify(wcag)).toString();
        } catch (e) {
          console.log("Issue loading wcag JSON string in " + id + " when looking up wcag value " + wcag + " on " + page);
          console.log(wcag);
        }

        /* Get links to WCAG */
        const wcagLinks = wcag
          ? wcag.map(element => wcagList.find(obj => obj.wcag === element) || { wcag: element }) : null;

        /* Count impactOrder, url  */
        if (impactOrder[impact] == 4) { ++criticalCount; }
        else if (impactOrder[impact] == 3) { ++seriousCount; }
        else if (impactOrder[impact] == 2) { ++moderateCount; }
        else if (impactOrder[impact] == 1) { ++minorCount; }
        else if (impactOrder[impact] == 0) { ++unknownCount; }
        else { console.log(impactOrder[impact]) }

        /* Count number of WCAG issues */
        if (wcagID.length > 0 ) {
          wcagCounts.push(wcagID);
        }

        /* Build array with all of the issues */
        flattenedIssues.push({
          id,
          url,
          page,
          sentenceCount,
          fleschKincaidGrade,
          automatedReadabilityIndex,
          difficultWords,
          fileExtension,
          description,
          impact,
          helpUrl,
          htmlElement: item.htmlElement,
          order: impactOrder[impact],
          wcagID,
          wcagLinks,
          disabilities,
          disabilityIcons,
        });
    });
  });

  return Promise.all(
    flattenedIssues.map(async issue => {
      const { disabilityIcons, disabilities, impact, ...rest } = issue;
      const icons = disabilities ? await fetchIcons(disabilities, impact) : null;
      return { ...rest, impact, disabilities, disabilityIcons: icons };
    }),
  );
};

exports.mergeFiles = async randomToken => {
  const storagePath = getStoragePath(randomToken);
  const directory = `${storagePath}/${allIssueFileName}`;
  let allIssues = [];
  const allFiles = await extractFileNames(directory);

  await Promise.all(
    allFiles.map(async file => {
      const rPath = `${directory}/${file}`;
      const flattenedIssues = await flattenAxeResults(rPath);

      allIssues = allIssues.concat(flattenedIssues);

    }),
  ).catch(flattenIssuesError => console.log('Error flattening all issues', flattenIssuesError));

  /* Write the JSON then the HTML - Order Matters */
  if(allFiles.length > 0) {
    console.log("Writing issues to JSON & HTML.")
    await writeResults(allIssues, storagePath);
    await writeHTML(allIssues, storagePath);
  } else {
    console.log("No entities in allFiles.");
  }

};
