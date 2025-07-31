// ----- 1) Load and transform your CSV into a long array -----
d3.csv("combined_clean.csv", d3.autoType).then(raw => {
  // raw: array of rows, each with country + 210 pairs of columns (e.g. "1960_life", "1960_gdp")

  // 1a) Figure out which years you have
  //    Look at all column names ending in "_life", strip that suffix.
  const years = raw.columns
    .filter(c => c.endsWith("_life"))
    .map(c => +c.replace("_life",""))
    .sort((a,b) => a - b);

  // 1b) Build long-form data: {country, year, lifeExp, gdpPercap}
  const allData = [];
  raw.forEach(row => {
    years.forEach(year => {
      const life  = row[`${year}_life`];
      const gdp   = row[`${year}_gdp`];
      if (life != null && gdp != null) {
        allData.push({
          country:   row.country,
          year:      year,
          lifeExp:   life,
          gdpPercap: gdp
        });
      }
    });
  });

  // 1c) Now that data is ready, initialize the scene:
  initScene1(allData, years);
});


// ----- 2) Set up Scene 1: slider + scatterplot -----
function initScene1(data, years) {
  // Save references to your DOM elements / scales / axes:
  const svg = d3.select("#viz");
  const margin = { top: 40, right: 30, bottom: 50, left: 70 };
  const W = +svg.attr("width")  - margin.left - margin.right;
  const H = +svg.attr("height") - margin.top  - margin.bottom;
  const g = svg.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  // Scales (x is log for GDP, y is linear for life expectancy)
  const x = d3.scaleLog().range([0, W]);
  const y = d3.scaleLinear().range([H, 0]);
  const color = d3.scaleOrdinal(d3.schemeCategory10);

  // Axes placeholders
  g.append("g").attr("class","x-axis").attr("transform", `translate(0,${H})`);
  g.append("g").attr("class","y-axis");

  // Axis labels
  svg.append("text")
    .attr("x", margin.left + W/2).attr("y", margin.top + H + 40)
    .attr("text-anchor", "middle")
    .text("GDP per Capita (log scale)");
  svg.append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -margin.top - H/2).attr("y", margin.left - 50)
    .attr("text-anchor", "middle")
    .text("Life Expectancy (years)");

  // Tooltip element
  const tooltip = d3.select("#tooltip");

  // 2a) Draw function for any selected year:
  function render(year) {
    // 1) Filter data for that year
    const yearData = data.filter(d => d.year === year);

    // 2) Update scale domains
    x.domain(d3.extent(yearData, d => d.gdpPercap)).nice();
    y.domain(d3.extent(yearData, d => d.lifeExp)).nice();
    color.domain([...new Set(data.map(d => d.country))]); // optionally map continents if you had that field

    // 3) Update axes
    g.select(".x-axis").call(d3.axisBottom(x).ticks(10, "~s"));
    g.select(".y-axis").call(d3.axisLeft(y));

    // 4) Bind circles
    const circles = g.selectAll("circle").data(yearData, d => d.country);

    circles.join(
      enter => enter.append("circle")
        .attr("r", 4)
        .attr("fill", "#1f77b4")
        .attr("cx", d => x(d.gdpPercap))
        .attr("cy", d => y(d.lifeExp))
        .on("mouseover", (evt, d) => {
          tooltip
            .style("opacity", 1)
            .style("left", (evt.pageX+10) + "px")
            .style("top",  (evt.pageY-25) + "px")
            .html(`${d.country}<br>${d.lifeExp} yrs<br>$${Math.round(d.gdpPercap)}`);
        })
        .on("mouseout", () => tooltip.style("opacity", 0)),
      update => update
        .transition().duration(500)
          .attr("cx", d => x(d.gdpPercap))
          .attr("cy", d => y(d.lifeExp)),
      exit => exit.remove()
    );

    // 5) Annotation: highlight the country with max GDP
    const richest = yearData.reduce((a, b) => b.gdpPercap > a.gdpPercap ? b : a, yearData[0]);
    g.selectAll(".anno").remove();
    const anno = d3.annotation()
      .annotations([{
        note: { title: richest.country, label: `$${Math.round(richest.gdpPercap)}, ${richest.lifeExp} yrs` },
        x: x(richest.gdpPercap), y: y(richest.lifeExp),
        dx: -50, dy: -50
      }]);
    g.append("g").attr("class","anno").call(anno);
  }

  // 2b) Wire up the slider
  const slider = d3.select("#year-slider")
    .attr("min", d3.min(years))
    .attr("max", d3.max(years))
    .attr("value", d3.max(years));

  const label = d3.select("#year-label").text(slider.property("value"));

  slider.on("input", function() {
    const yr = +this.value;
    label.text(yr);
    render(yr);
  });

  // 2c) Initial draw for the max year
  render(+slider.property("value"));
}
