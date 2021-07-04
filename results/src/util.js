/**
 * 
    Pulled mapRow and parseTable from https://gist.github.com/WickyNilliams/9252235 and modified for our use.
 */

/**
 * generates factory functions to convert table rows to objects,
 * based on the titles in the table's <thead>
 * @param  {Array<String>} headings the values of the table's <thead>
 * @return {(row: HTMLTableRowElement) => Object} a function that takes a table row and spits out an object
 */
function mapRow(headings) {
    return function mapRowToObject({ cells }) {
        return [...cells].reduce(function(result, cell, i) {
            const input = cell.querySelector("input,select");
            var value;

            if (input) {
                value = input.type === "checkbox" ? input.checked : input.value;
            } else {
                value = cell.innerText;
            }

            return Object.assign(result, {
                [headings[i].replace(" ", "")]: value
            });
        }, {});
    };
}

/**
 * given a table, generate an array of objects.
 * each object corresponds to a row in the table.
 * each object's key/value pairs correspond to a column's heading and the row's value for that column
 *
 * @param  {HTMLTableElement} table the table to convert
 * @return {Array<Object>}       array of objects representing each row in the table
 */
export const parseTable = (table) => {
    var headings = [...table.tBodies[0].rows[0].cells].map(
        heading => heading.innerText
    );

    return [...table.tBodies[0].rows].map(mapRow(headings));
}

function getConeHits(entry) {

    if (entry.includes("dnf")) {
        return 0
    }

    if (entry.includes("+")) {
        return parseInt(entry.split("+")[1]);
    } else {
        return 0;
    }
}

function getTime(entry) {
    if (entry.includes("+")) {
        return entry.split("+")[0]
    } else {
        return entry
    }
}

function parseRuns(records, extended) {

    var runs = []

    for (let i = 0; i < Object.keys(records).length; i++) {

        var key = Object.keys(records)[i]

        if (key.includes("Run")) {
            var number = parseInt(key.replace("Run", "").replace("..", ""))
            runs.push({
                "number": number,
                "time": getTime(records[key]).replace(/(\r\n|\n|\r)/gm, "").trim(),
                "dnf": records[key].includes("dnf"),
                "cones": getConeHits(records[key]),
                "raw": records[key]
            })
        }
    }

    for (let i = 0; i < Object.keys(extended).length; i++) {

        key = Object.keys(extended)[i]

        if (key.includes("Run")) {
            number = parseInt(key.replace("Run", "").replace("..", ""))
            runs.push({
                "number": number + 10,
                "time": getTime(extended[key]),
                "dnf": extended[key].includes("dnf"),
                "cones": getConeHits(extended[key]),
                "raw": extended[key]
            })
        }
    }

    return runs
}

function parsePosition(pos) {
    if (pos.includes("T")) {
        return parseInt(pos.replace("T", ""));
    } else {
        return parseInt(pos);
    }
}

function isTrophy(pos) {
    return pos.includes("T")
}

function getNextRow(data, i) {
    if (i + 1 < data.length) {
        return data[i + 1]
    } else {
        return null
    }
}

const getClassFullName = (shortName) => {
    switch (shortName) {
        case "es":
            return "experienced street";
        case "er":
            return "experienced race";
        case "int":
            return "intermediate";
        case "n":
            return "novice";
        default:
            return shortName;
    }
}

export const parseResults = (data) => {

    // var results = [];
    var results = {
        class: {},
        drivers: []
    }

    // start at 1 to because it's the table header, and because
    // why not use the actual table head directive?
    for (let i = 1; i < data.length; i++) {

        var row = data[i];

        // because we're dealing with silly nonsense, the next row contains
        // additional runs, but there is no indication it's included with this row.
        var next_row = getNextRow(data, i)

        // skip if table line break
        // imagine how much less stupid this code would be if
        // they used web concepts from the last 20 years?
        if (!('Driver' in row)) {
            continue;
        }

        var result = {
            "name": row.Driver,
            "number": row['#'],
            "class": row.Class,
            "car": row.CarModel,
            "runs": parseRuns(row, next_row),
            "trophy": isTrophy(row["Pos."]),
            "position": parsePosition(row["Pos."])
        }

        // TODO: refactor
        if (results.class.hasOwnProperty(row.Class)) {
            results.class[row.Class].count = results.class[row.Class].count + 1
        } else {
            results.class[row.Class] = { count: 1, name: getClassFullName(row.Class), alias: row.Class }
        }

        // these are extra runs, skip for now
        if (next_row) {
            i++
        }

        results.drivers.push(result)
    }
    return results;
}

export const displayRun = (run) => {

    if (run.time === 999.999) {
        return 'dns'
    }

    if (run.dnf) {
        return `${run.time}+dnf`
    }

    if (run.cones > 0) {
        return `${run.time}+${run.cones}`
    }

    return `${run.time}`
}

export const actualTime = (run) => {

    var penalty = 2.000

    if (run.dnf) {
        return 999.999
    }

    if (run.cones > 0) {
        return parseFloat(run.time) + (run.cones * penalty)
    }

    return parseFloat(run.time)
}

export const countRuns = (runs) => {
    return runs.filter((run) => {
        return run.time !== null && run.time !== ''
    }).length
}

export const latestRun = (runs) => {
    runs = runs.filter((run) => {
        return run.time !== null && run.time !== ''
    })

    if (runs.length === 0) {
        return 'dns'
    }
    return displayRun(runs[runs.length - 1]);
}

export const fastestRun = (runs) => {
    var fastest = { time: 999.999, dnf: false, cones: 0 };
    runs.forEach((run, index, runs) => {
        if (actualTime(run) < actualTime(fastest) && !run.dnf) {
            fastest = run;
        }
    })
    return displayRun(fastest)
}

export const initDoc = (body) => {
    return (new DOMParser()).parseFromString(body, 'text/html');
}

export const parseResultsFromHtml = (data) => {
    var doc = initDoc(data)
    const table = doc.querySelectorAll("table")[3]
    return parseResults(parseTable(table));
}

// eslint-disable-next-line
const fetchData = async() => {
    const res = await fetch('results_sample.html');
    const data = await res.text();
    // console.log(results)
    return parseResultsFromHtml(data);
}


// exec a func on component render
// [results, setResults] = useState(() => {
//   console.log('run func')
//   return 4
// })

// useEffect(() => {
//     fetch('url')
//       .then(response => response.json())
//       .then(json => console.log(json))
// // eslint-disable-next-line 
// }, [results])

// useEffect(() => {
//     const getData = async() => {
//         const data = await fetchData()
//         setResults(data)
//     }
//     getData();
// // eslint-disable-next-line 
// }, results)