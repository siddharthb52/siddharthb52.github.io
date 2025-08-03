// ----- GLOBAL STATE -----
let allData, years;
let currentScene = 0;
const sceneTitles = [
  "Scene 1 - GDP vs. Life Expectancy Throughout History",
  "Scene 2 - Top 10 Increases in GDP to Life Expectancy Ratio (21st Century)",
  "Scene 3 - Country Spotlight: U.S. GDP and Life Expectancy Over Time"
];
const scenes = [renderScene1, renderScene2, renderScene3];

// Shared layout variables (filled in scene1 init)
let margin, W, H, g, x, y, tooltip;

// ----- 1) LOAD & PIVOT DATA -----
d3.csv("combined_clean.csv", d3.autoType).then(raw => {
  // get years from "_life" columns, trim >2025
  years = raw.columns
    .filter(c => c.endsWith("_life"))
    .map(c => +c.replace("_life",""))
    .filter(y => y <= 2025)
    .sort((a,b)=>a-b);

  // pivot to long form
  allData = [];
  raw.forEach(row => {
    years.forEach(year => {
      const life = row[`${year}_life`],
            gdp  = row[`${year}_gdp`];
      if (life != null && gdp != null) {
        allData.push({ country: row.country, year, lifeExp: life, gdpPercap: gdp });
      }
    });
  });

  // start the slideshow
  render();
});

// ----- 2) MASTER RENDER + NAV -----
function render() {
  // title
  d3.select("#scene-title").text(sceneTitles[currentScene]);

  // clear
  d3.select("#controls").html("");
  d3.select("#viz").html("");
  d3.select("#tooltip").style("opacity", 0);

  // nav buttons
  addNavButtons();

  // scene-specific
  scenes[currentScene]();
}

function addNavButtons() {
  const ctrl = d3.select("#controls");
  if (currentScene > 0) {
    ctrl.append("button")
        .text("← Back")
        .on("click", () => { currentScene--; render(); });
  }
  if (currentScene < scenes.length - 1) {
    ctrl.append("button")
        .text("Next →")
        .on("click", () => { currentScene++; render(); });
  }
}

// A wrap for annotations used in scene 3: splits a <text> into tspans at a max px width
function wrap(textSel, width) {
    textSel.each(function() {
      const text = d3.select(this);
      const words = text.text().split(/\s+/).reverse();
      let word,
          line = [],
          lineNumber = 0,
          lineHeight = 1.1,
          y = text.attr("y") || 0,
          dy = parseFloat(text.attr("dy")) || 0,
          tspan = text.text(null)
                      .append("tspan")
                      .attr("x", 0)
                      .attr("y", y)
                      .attr("dy", dy + "em");
      while (word = words.pop()) {
        line.push(word);
        tspan.text(line.join(" "));
        if (tspan.node().getComputedTextLength() > width) {
          line.pop();
          tspan.text(line.join(" "));
          line = [word];
          tspan = text.append("tspan")
                      .attr("x", 0)
                      .attr("y", y)
                      .attr("dy", ++lineNumber * lineHeight + dy + "em")
                      .text(word);
        }
      }
    });
  }

// ----- 3) SCENE 1 -----
function renderScene1() {
  // common layout setup (once per scene1 init)
  margin = { top: 40, right: 30, bottom: 50, left: 70 };
  const svg = d3.select("#viz");
  svg.selectAll("*").remove();

  W = +svg.attr("width")  - margin.left - margin.right;
  H = +svg.attr("height") - margin.top  - margin.bottom;
  g = svg.append("g")
         .attr("transform", `translate(${margin.left},${margin.top})`);

  x = d3.scaleLog().range([0, W]);
  y = d3.scaleLinear().range([H, 0]);
  tooltip = d3.select("#tooltip");

  g.append("g").attr("class","x-axis").attr("transform", `translate(0,${H})`);
  g.append("g").attr("class","y-axis");

  svg.append("text")
     .attr("x", margin.left + W/2).attr("y", margin.top + H + 40)
     .attr("text-anchor", "middle")
     .text("GDP per Capita (log scale)");

  svg.append("text")
     .attr("transform", "rotate(-90)")
     .attr("x", -margin.top - H/2).attr("y", margin.left - 50)
     .attr("text-anchor", "middle")
     .text("Life Expectancy (years)");

  // slider control
  const ctrl = d3.select("#controls");
  ctrl.append("label").text("Year: ");
  ctrl.append("input")
      .attr("type","range")
      .attr("min", d3.min(years))
      .attr("max", d3.max(years))
      .attr("value", d3.max(years))
      .attr("id","scene1-slider")
      .on("input", function() {
        const yr = +this.value;
        d3.select("#scene1-label").text(yr);
        drawScene1(yr);
      });

  ctrl.append("span")
      .attr("id","scene1-label")
      .text(d3.max(years));

  // initial draw
  drawScene1(d3.max(years));
}

function drawScene1(year) {
  // filter valid data
  let yearData = allData.filter(d => d.year === year)
                        .filter(d => d.gdpPercap > 0 && d.lifeExp > 0);

  // update domains & axes
  x.domain(d3.extent(yearData, d => d.gdpPercap)).nice();
  y.domain(d3.extent(yearData, d => d.lifeExp)).nice();

  g.select(".x-axis").transition().call(d3.axisBottom(x).ticks(10,"~s"));
  g.select(".y-axis").transition().call(d3.axisLeft(y));

  // data join
  const circles = g.selectAll("circle").data(yearData, d=>d.country);

  // enter + merge
  circles.enter().append("circle")
      .attr("r",4)
      .attr("fill","#1f77b4")
      .on("mouseover", onMouseOver)
      .on("mouseout", onMouseOut)
    .merge(circles)
    .transition().duration(500)
      .attr("cx", d=>x(d.gdpPercap))
      .attr("cy", d=>y(d.lifeExp));

  // exit
  circles.exit().transition().duration(500)
      .attr("r",0).remove();

  // annotation
  g.selectAll(".anno").remove();
  const richest = yearData.reduce((a,b)=>b.gdpPercap>a.gdpPercap?b:a, yearData[0]);
  const anno = d3.annotation().annotations([{
    note: {
      title: richest.country,
      label: `$${Math.round(richest.gdpPercap)}, ${richest.lifeExp} yrs`
    },
    x: x(richest.gdpPercap),
    y: y(richest.lifeExp),
    dx: -50, dy: -50
  }]);
  g.append("g").attr("class","anno").call(anno);
}

function onMouseOver(evt, d) {
  tooltip.style("opacity",1)
         .style("left", (evt.pageX+10)+"px")
         .style("top",  (evt.pageY-25)+"px")
         .html(`${d.country}<br>${d.lifeExp} yrs<br>$${Math.round(d.gdpPercap)}`);
}
function onMouseOut() {
  tooltip.style("opacity",0);
}


// ----- SCENE 2: Top 3 Countries by change in (GDP / LifeExp) over 2000-->2025 
function renderScene2() {
  // No extra controls needed here. we can just show the slope-chart
  drawScene2();
}

function drawScene2() {
  // Clear SVG and set up dimensions
  const svg = d3.select("#viz").html("");
  const margin = { top: 50, right: 50, bottom: 70, left: 120 };
  const W = +svg.attr("width")  - margin.left - margin.right;
  const H = +svg.attr("height") - margin.top  - margin.bottom;
  const g2 = svg.append("g")
                .attr("transform", `translate(${margin.left},${margin.top})`);

  // Build ratio maps for 2000 & 2025
  const r2000 = new Map(allData
    .filter(d => d.year === 2000)
    .map(d => [d.country, d.gdpPercap / d.lifeExp]));
  const r2025 = new Map(allData
    .filter(d => d.year === 2025)
    .map(d => [d.country, d.gdpPercap / d.lifeExp]));

  // Compute delta and pick top 10
  const deltas = [];
  r2000.forEach((r0, c) => {
    const r1 = r2025.get(c);
    if (r1 != null) deltas.push({ country: c, r0, r1, delta: r1 - r0 });
  });
  deltas.sort((a, b) => b.delta - a.delta);
  const top10 = deltas.slice(0, 10);

  // Scales
  const x = d3.scaleLinear()
      .domain([
        d3.min(top10, d => d.r0),
        d3.max(top10, d => d.r1)
      ]).nice()
      .range([0, W]);
  const y = d3.scalePoint()
      .domain(top10.map(d => d.country))
      .range([0, H])
      .padding(0.5);

  // Y-axis with tickPadding only (labels offset from axis line)
  g2.append("g")
    .call(
      d3.axisLeft(y)
        .tickSize(0)
        .tickPadding(12)
    )
    .selectAll("text")
       .style("text-anchor", "end")  // anchor to right side
       .attr("dx", "-0.5em");

  // X-axis at bottom
  g2.append("g")
    .attr("transform", `translate(0,${H})`)
    .call(d3.axisBottom(x).ticks(6));

  // Axis labels
  svg.append("text")
     .attr("x", margin.left + W/2)
     .attr("y", margin.top + H + 55)
     .attr("text-anchor", "middle")
     .text("Ratio of GDP per Capita to Life Expectancy");

  svg.append("text")
     .attr("transform", "rotate(-90)")
     .attr("x", -margin.top - H/2)
     .attr("y", 20)
     .attr("text-anchor", "middle")
     .text("Country");

  // Legend for 2000 (blue) and 2025 (red)
  const legend = svg.append("g")
    .attr("transform", `translate(${margin.left + W - 150}, ${margin.top - 30})`);
  legend.append("circle").attr("cx", 0).attr("cy", 0).attr("r", 5).attr("fill", "#1f77b4");
  legend.append("text").attr("x", 10).attr("y", 4).text("2000").style("font-size", "12px");
  legend.append("circle").attr("cx", 70).attr("cy", 0).attr("r", 5).attr("fill", "#d62728");
  legend.append("text").attr("x", 80).attr("y", 4).text("2025").style("font-size", "12px");

  // Draw lines and points
  const rows = g2.selectAll(".row").data(top10).join("g");

  rows.append("line")
      .attr("x1", d => x(d.r0))
      .attr("x2", d => x(d.r1))
      .attr("y1", d => y(d.country))
      .attr("y2", d => y(d.country))
      .attr("stroke", "#888")
      .attr("stroke-width", 2);

  rows.append("circle")
      .attr("cx", d => x(d.r0))
      .attr("cy", d => y(d.country))
      .attr("r", 5)
      .attr("fill", "#1f77b4");

  rows.append("circle")
      .attr("cx", d => x(d.r1))
      .attr("cy", d => y(d.country))
      .attr("r", 5)
      .attr("fill", "#d62728");

  // 1Annotation on the top country
  const top = top10[0];
  const ax = margin.left + x(top.r1);
  const ay = margin.top  + y(top.country);
  const annG = svg.append("g").attr("class", "anno");
  const annotation = d3.annotation().annotations([{
    note: {
      title: top.country,
      label: `Δ = ${(top.delta).toFixed(2)}`
    },
    x: ax, y: ay,
    dx: 80, dy: -30
  }]);
  annG.call(annotation);

  
}


function renderScene3() {

  drawScene3();
}

function drawScene3() {
  // Clear & smoke‐test
  const svg = d3.select("#viz");
  svg.selectAll("*").remove();

  // // smoke test—should appear at raw SVG (50,50)
  // svg.append("text")
  //    .attr("transform","translate(50,50)")
  //    .style("fill","black")
  //    .style("font-size","14px")
  //    .text("TEST");

  // Margins & inner dimensions
  const margin = { top: 80, right: 80, bottom: 80, left: 80 };
  const W = +svg.attr("width")  - margin.left - margin.right;
  const H = +svg.attr("height") - margin.top  - margin.bottom;

  // Main group
  const g3 = svg.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  // Filter & sort USA data
  const usaData = allData
    .filter(d => d.country === "USA")
    .sort((a, b) => a.year - b.year);

  // Scales
  const x = d3.scaleLinear()
    .domain(d3.extent(usaData, d => d.year))
    .range([0, W]);
  const yGDP = d3.scaleLinear()
    .domain([0, d3.max(usaData, d => d.gdpPercap)]).nice()
    .range([H, 0]);
  const yLife = d3.scaleLinear()
    .domain([
      d3.min(usaData, d => d.lifeExp) - 1,
      d3.max(usaData, d => d.lifeExp) + 1
    ]).nice()
    .range([H, 0]);

  // Axes
  g3.append("g")
    .attr("transform", `translate(0,${H})`)
    .call(d3.axisBottom(x).tickFormat(d3.format("d")));
  g3.append("g")
    .call(d3.axisLeft(yGDP))
    .attr("class","axisBlue");
  g3.append("g")
    .attr("transform", `translate(${W},0)`)
    .call(d3.axisRight(yLife))
    .attr("class","axisRed");

  // Line generators
  const lineGDP  = d3.line().x(d=>x(d.year)).y(d=>yGDP(d.gdpPercap));
  const lineLife = d3.line().x(d=>x(d.year)).y(d=>yLife(d.lifeExp));

  // Draw lines
  g3.append("path")
    .datum(usaData)
    .attr("fill","none").attr("stroke","steelblue").attr("stroke-width",2)
    .attr("d", lineGDP);

  g3.append("path")
    .datum(usaData)
    .attr("fill","none").attr("stroke","crimson").attr("stroke-width",2)
    .attr("d", lineLife);

// Axis Labels

// X-axis (“Year”)
g3.append("text")
  .attr("transform", `translate(${W/2}, ${H + margin.bottom - 20})`)
  .attr("text-anchor", "middle")
  .style("font-size", "12px")
  .text("Year");

// Left Y-axis (“GDP per Capita”)
g3.append("text")
  .attr(
    "transform",
    // move left of the chart by (margin.left - 20), and vertically center at H/2,
    // then rotate −90° around that point
    `translate(${-margin.left + 20}, ${H/2}) rotate(-90)`
  )
  .attr("text-anchor", "middle")
  .style("fill", "steelblue")
  .style("font-size", "12px")
  .text("GDP per Capita (USD)");

// Right Y-axis (“Life Expectancy”)
g3.append("text")
  .attr(
    "transform",
    // move right of the chart by (W + margin.right - 20), center vertically at H/2,
    // then rotate +90° around that point
    `translate(${W + margin.right - 20}, ${H/2}) rotate(90)`
  )
  .attr("text-anchor", "middle")
  .style("fill", "crimson")
  .style("font-size", "12px")
  .text("Life Expectancy (years)");

  // Legend
  const legend = g3.append("g")
    .attr("transform", `translate(${W-200}, -50)`);
  legend.append("circle").attr("cx",0).attr("cy",0).attr("r",5).attr("fill","steelblue");
  legend.append("text").attr("x",10).attr("y",4).text("GDP per Capita").style("font-size","12px");
  legend.append("circle").attr("cx",140).attr("cy",0).attr("r",5).attr("fill","crimson");
  legend.append("text").attr("x",150).attr("y",4).text("Life Expectancy").style("font-size","12px");


  // Defining an arrowhead marker
  g3.append("defs").append("marker")
    .attr("id", "arrow")
    .attr("viewBox", "0 -5 10 10")
    .attr("refX", 10)
    .attr("refY", 0)
    .attr("markerWidth", 6)
    .attr("markerHeight", 6)
    .attr("orient", "auto")
    .append("path")
      .attr("d", "M0,-5L10,0L0,5")
      .attr("fill", "#555");

  // Helper to draw annotation
  function drawAnnotation(xPos, yPos, dx, dy, title, label, color) {
    const lineHeight = 1.1; // must match your wrap() helper’s lineHeight

    // Connector line + arrow
    g3.append("line")
      .attr("x1", xPos).attr("y1", yPos)
      .attr("x2", xPos + dx).attr("y2", yPos + dy)
      .attr("stroke", color)
      .attr("stroke-width", 1.5)
      .attr("marker-end", "url(#arrow)");

    // Text group positioned at the arrow tip
    const tg = g3.append("g")
      .attr("transform", `translate(${xPos + dx},${yPos + dy})`);

    // Choose text‐anchor based on direction
    const anchor = dx < 0 ? "end" : "start";

    // Title block (wrapped)
    const titleText = tg.append("text")
      .attr("dy", "-0.3em")
      .attr("text-anchor", anchor)
      .style("font-size", "12px")
      .style("font-weight", "bold")
      .style("fill", color)
      .text(title)
      .call(wrap, 100);      // wrap at 100px

    // how many lines the title took?
    const titleLines = titleText.selectAll("tspan").size() || 1;

    // Label block, pushed down below the title
    tg.append("text")
      .attr("dy", `${titleLines * lineHeight + 0.5}em`)
      .attr("text-anchor", anchor)
      .style("font-size", "10px")
      .style("fill", color)
      .text(label)
      .call(wrap, 120);      // wrap at 120px
  }

  // Specific data points
  const pt1861 = usaData.find(d => d.year === 1861);
  const pt1916 = usaData.find(d => d.year === 1916);
  const pt2008 = usaData.find(d => d.year === 2008);

  // Draw the two annotations
  drawAnnotation(
    x(pt1861.year),      // x(1861)
    yLife(pt1861.lifeExp),// lifeExp drop
    -60, -50,             // dx, dy (tweak if needed)
    "Civil War (1861)",
    "Life expectancy plunged during the Civil War.",
    "black"
  );

  drawAnnotation(
    x(pt1916.year),        // x(1916)
    yLife(pt1916.lifeExp),  // lifeExp dip
    +20, -150,               // dx, dy
    "World War I (1916)\n",
    "A noticeable dip in life expectancy during WWI.",
    "black"
  );

  drawAnnotation(
    x(pt2008.year),
    yGDP(pt2008.gdpPercap),
    -20, 170,
    "Financial Crisis (2008)",
    "Noticeable economic harm during the 2008 crisis.",
    "black"
  );

  

  
  


}





