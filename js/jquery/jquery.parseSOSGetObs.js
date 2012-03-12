///////////////////////
// Author: Eric Bridger ebridger@gmri.org  eric.bridger@gmail.com
// Date:   Feb. 2011
// Describption: Use JQuery to parse OGC Sensor Observation Service GetObservation response XML in both SWE and IOOS DIF formats
// Requires:  jQuery 1.5 http://code.jquery.com/jquery-1.5.min.js
// Tested with:  jQuery 1.6.1 http://code.jquery.com/jquery-1.6.1.min.js
// Tested with:  jQuery 1.7.1 http://code.jquery.com/jquery-1.7.1.min.js
//
// Wed Feb 15 12:34:15 EST 2012
// Updated to jQuery 1.7.x via the following plugin function filterNode() which replaces [nodeName...] syntax
// for finding node names with namespace prefixes.  This also supposedly improves performance greatly and is backward compatible.
// $(xml).find("[nodeName='ows:Title']").text(); now
// $(xml).filterNode('ows:Title').text();
// For more details see:
// http://www.steveworkman.com/html5-2/javascript/2011/improving-javascript-xml-node-finding-performance-by-2000/
//
//////////////////////////
jQuery.fn.filterNode = function(name) {
    return this.find('*').filter(function() {
        return this.nodeName === name;
     });
};
//////////////////////////
// in all these calls xml refers to a DOM object created by jQuery from the Ajax retrieved XML document.
function SOSObservation(xml)
{
	this.checkSOSType(xml);
	if(this.type === 'EXCEPTION' ){
		return;
	}

	this.metadata = parseMetadataObs(xml, this.type)

	var Obs;

	if(this.type === 'DIF'){
		Obs = parseDIFObs(xml, this.metadata.platforms);
	}
	if(this.type === 'SWE'){
		Obs = parseSWEObs(xml);
	}
	this.fields = Obs.fields;
	this.observations = Obs.observations;

}

// returns 'SWE' or 'DIF'.  Also checks for SOS Exception's
SOSObservation.prototype.checkSOSType = function(xml){
	var root_node = $(xml).find("*");
	// Check for SOS ExceptionReport
	var tag = root_node.get(0).tagName;
	if(tag.match(/^Exception/i)){
		var code = $(xml).find("Exception").attr('exceptionCode');
		var locator = $(xml).find("Exception").attr('locator');
		var error = code + ' ' + locator + ' ' + $(xml).find("ExceptionText").text();
		this.type = 'EXCEPTION';
		this.exception_error = error;
		return;
	}
	// OOSTethys (SWE) uses ows: namespace
	if(tag.match(/^ows\:Exception/i)){
		var code = $(xml).find("ows\\:Exception").attr('exceptionCode');
		var locator = $(xml).find("ows\\:Exception").attr('locator');
		var error = code + ' ' + locator + ' ' + $(xml).find("ows\\:ExceptionText").text();
		this.type = 'EXCEPTION';
		this.exception_error = error;
		return;
	}
    // Sanity check for some type of Observation XML
	if(!tag.match(/Observation/i)){
		this.type = 'EXCEPTION';
		this.exception_error = "Unknown.  Not an SOS O&M XML response."
		return;
    }
	// Search for the IOOS DIF namespace in the root element
	if( root_node.attr('xmlns:ioos') ){
		this.type = 'DIF';
		this.exception_error = '';
		return;
	}else{
		this.type = 'SWE';
		this.exception_error = '';
		return;
	}
	// if we got here some unknown error
	this.type = 'EXCEPTION';
	this.exception_error = 'Unknown';
}

// returns Metadata object with various properties, from the SOS GetObservation response
function parseMetadataObs(xml, type)
{
	var md = new Object;
	md.platforms = [];
	md.observedProperties = [];
	var arr = [];

	//md.description = $(xml).find('gml:description:first').text();
    // THIS WORKS
	md.description = $(xml).filterNode('gml:description').first().text();

	md.name = $(xml).filterNode('gml:name').first().text();

	var lower = $(xml).filterNode('gml:lowerCorner').last().text();
	var upper = $(xml).filterNode('gml:upperCorner').last().text();
	arr = lower.split(' ');
	md.llat = arr.shift();
	md.llon = arr.shift();
	arr = upper.split(' ');
	md.ulat = arr.shift();
	md.ulon = arr.shift();

	md.start_time = $(xml).filterNode('gml:beginPosition').text();
	md.end_time = $(xml).filterNode('gml:endPosition').text();
	if(! md.start_time){ // SWE latest,i.e. one time uses TimeInstant
		md.start_time = $(xml).filterNode('gml:TimeInstant').text();
		md.end_time = $(xml).filterNode('gml:TimeInstant').text();
	}

	// observedProperties
	if(type === 'DIF'){
		var op = $(xml).filterNode('om:observedProperty').attr('xlink:href');
		if(op){
			md.observedProperties.push(op);
		}
	}
	if(type === 'SWE'){
		var prop = $(xml).filterNode('om:observedProperty');
		prop.filterNode('swe:component').each(function() {
			var op = $(this).attr('xlink:href');
			if(op){
				md.observedProperties.push(op);
			}
		});
	}
	// find platform info
	var proc = $(xml).filterNode('om:procedure');
	if(type === 'SWE'){
		var sta = new Object;
		sta.stationId = proc.attr('xlink:href');
		sta.shortStationId = proc.attr('xlink:href').split(':').pop();
		sta.stationName = md.name;
		sta.stationDescription = md.description;
		sta.lat = md.llat;
		sta.lon = md.llon;
		md.platforms.push(sta);
	}

if(type === 'DIF'){
	var station_gmlids = [];
	// New logic to ONLY get stations which have results as parseDIF finds.
	// collect gml:id for each Point Observation returned from om:results, i.e. gml:id's which had observations
	// This processDef attribute maps back to the om:procedure gml:id's for the station
	// The WorkFlow All file, had 13 station's in om:procedure, but only 11 on om:results with actual readings
	$(xml).filterNode('ioos:Composite').each(function() {
		var comp = $(this);
		var id = comp.attr('gml:id');
		if(! id.match(/Point$/i)){
			return true;
		}
		var station_gmlid = comp.filterNode('ioos:CompositeContext').attr('processDef');
		// remove leading #
		station_gmlid = station_gmlid.substr(1);
		station_gmlids[station_gmlid] = 1;
	});

	// Find StationName and all relevant siblings

	// O.K. There is an extra CompositeContext surrounding all the station info within om:procedure
	// so find the first top, then loop with find
	var ccTop = proc.filterNode('ioos:CompositeContext');
	ccTop.filterNode('ioos:CompositeContext').each(function(i) {
		var CC = $(this);
		// we only want the first of the pair of CompositeContext's
		if( ! ( i % 2 == 0) ){
			return(true);
		}
		var station_gml_id = CC.attr('gml:id');
		//  Check this gml:id against the processDef's collected from the om:results, only add those which match
		for(gmlid in station_gmlids){
			// O.K. we've found a station which is also in om:results
			if(gmlid === station_gml_id){
				CC.filterNode('ioos:StationName').each(function() {
					var sta = new Object;
					var node = $(this);
					sta.gmlId = station_gml_id;
					sta.stationName = node.text();
					// get all siblings of StationName and check tagNames for the ones we want
					node.nextAll().each(function(){
						var tag = $(this).get(0).tagName;
						if(tag == 'ioos:StationId'){
							sta.stationId = $(this).text();
							sta.shortStationId = $(this).text().split(':').pop();
							return true;
						}
						if(tag == 'ioos:Organization'){
							sta.Organization = $(this).text();
							return true;
						}
						if(tag == 'gml:Point'){
							arr = $(this).filterNode('gml:pos').text().split(' ');
							sta.lat = arr.shift();
							sta.lon = arr.shift();
							return true;
						}
					}); // end nextAll StationName
					
					md.platforms.push(sta);
				}); // end CC find StationName
			} // end if station has obs
		} // end for gmlid in station_gmlids
	}); // end ccTop find

} // if DIF

	md.number_of_platforms = md.platforms.length;

	return md;
}

// parse OOSTethys SWE GetObservation response. Uses jQuery's filterNode() plugin filterNode('xxxx']).each method.
// returns SOSGetObs object with two property arrays. fields[] and observations[]
// fld Object { name: xxx  , uom: xxx, definition: xxx }
// any of these except name could be null
// obs Object { fld1: xxx  , fld2: xxx, fld3: xxx } same number of properties as the number of fields
// HERE
function parseSWEObs(xml)
{
	SOSGetObs = new Object;
	var flds = [];
	var obs = [];

	$(xml).filterNode('om:result').each(function() {
	// Bizzare But get(0) makes this work
		//var jj = $(this).get(0).tagName;
		var result = $(this);
		result.filterNode('swe:field').each(function() {
			var fldObj = new Object;
			var fld = $(this);
			var name = fld.attr("name");
			var uom = fld.filterNode('swe:uom').attr("code");
			var def = '';
			// OOSTethys uses swe:Time vs. swe:Quanity for time definition
			if(name.match(/time/i)){
				def = fld.filterNode('swe:Time').attr("definition");
			}else{
				def = fld.filterNode('swe:Quantity').attr("definition");
			}
			if(name.match(/^observedProperty/i)){
				// OOSTethys SWE uses observerdProperty1, 2, etc.  Need the Quanity definition attribute
				// to get a resonable name
				name = def.split(':').pop();
			}
			fldObj.name = name;
			fldObj.uom = uom;
			fldObj.definition = def;
			flds.push(fldObj);
		}); // end each field
		var encode = result.filterNode('swe:encoding');
		var node = encode.filterNode('swe:TextBlock');
		var block_sep = '';
		var token_sep = '';
		if(node){
			block_sep = node.attr("blockSeparator");
			token_sep = node.attr("tokenSeparator");
		}

		var values = result.filterNode('swe:values').text();
		var tuples = values.split(block_sep);
		for(var i = 0; i < tuples.length; i++){
			var vals = tuples[i].split(token_sep);
			var obsObj = new Object;
			for(var j = 0; j < vals.length; j++){
				var fld_name = flds[j].name;
				obsObj[fld_name] = vals[j];
			}
			obs.push(obsObj);
		}
	}); // end $(xml).find().each result

	SOSGetObs.fields = flds;
	SOSGetObs.observations = obs;

	return(SOSGetObs);

} // end parseSWEObs

function parseDIFObs(xml, platforms)
{
	SOSGetObs = new Object;
	var flds = [];
	var obs = [];

	var fnd_fld_names = false;

	// DIF has one observedProperty where the definition is in the xlink.href
	var definition = $(xml).filterNode('om:observedProperty').attr('xlink:href');


	var current_station_info = '';
	var current_station_idx = -1;
	$(xml).filterNode('ioos:Composite').each(function() {
		var comp = $(this);
		// This is the only real hack.  I.e. The only way I can find to differentiate the significant Composite is via the gml:id.
		// NEED to find a more programmatic marker
		var id = comp.attr('gml:id');
		if(! id.match(/Point$/i)){
			return true;
		}

		// DIF does not have a clear station or platform name in the results
		// Could try using platforms from the metadata parse
		var time = comp.filterNode('gml:timePosition').text();
		var station_info = comp.filterNode('ioos:CompositeContext').attr('processDef');
		if(station_info !== current_station_info){
			current_station_info = station_info;
			current_station_idx++;
		}

		if(fnd_fld_names == false){
			// stationId added for DIF, only need for multiple station results
			var fldObj = new Object;
			fldObj.name = 'stationId';
			fldObj.uom = null;
			fldObj.definition = null;
			flds.push(fldObj);

			fldObj = new Object;
			fldObj.name = 'Time';
			fldObj.uom = null;
			fldObj.definition = null;
			flds.push(fldObj);
			comp.filterNode('ioos:Quantity').each(function() {
				var fldObj = new Object;
				var quant = $(this);
				fldObj.name = quant.attr('name');
				fldObj.uom = quant.attr('uom');
				fldObj.definition = definition;
				flds.push(fldObj);
			});
			fnd_fld_names = true;
		} // end if fnd_fld_names

		var obsObj = new Object;
		// stationInfo added for DIF
		//var tmp = current_station_info.substr(1);
		var tmp = platforms[current_station_idx].shortStationId;
		obsObj.stationId = tmp;

		obsObj.Time = time;
		// we need to re-use var time then use i to access flds[i+1].name
		// if we added stationId need i+2
		comp.filterNode('ioos:Quantity').each(function(i) {
			var quant = $(this);
			var val = quant.text();
			var fld_name = flds[i+2].name;
			obsObj[fld_name] = val;
		});
		obs.push(obsObj);
	});

	SOSGetObs.fields = flds;
	SOSGetObs.observations = obs;

	return(SOSGetObs);

} // end parseDIFObs

///////////////////////////
/// Some utility output formats. Should wrap all these into an Object at some point
////////////////////////////
SOSObservation.prototype.metadataHTML = function ()
{

	var html = '<table cellpadding="4" border="1">';
	for( var name in this.metadata){
		if(name === 'platforms' || name === 'observedProperties'){
			continue;
		}
		html += '<tr><td><b>' + [name] + '</b></td><td>' + this.metadata[name] + '</td></tr>';
	}
	for (var i = 0; i < this.metadata.observedProperties.length; i++){
			html += '<tr><td><b>observedProperty</b></td><td>' + this.metadata.observedProperties[i] + '</td></tr>';
	}
	html += '<tr><td colspan="2" bgcolor="yellow">Platforms</td></tr>';
	for (var i = 0; i < this.metadata.platforms.length; i++){
		var platform = this.metadata.platforms[i];
		for(var plat in platform){
			html += '<tr><td><b>' + [plat] + '</b></td><td>' + platform[plat] + '</td></tr>';
		}
		if(this.metadata.platforms.length > 1){
			html += '<tr><td colspan="2" bgcolor="yellow"></td></tr>';
		}
	}
	html += '</table>';
	return html;
}

SOSObservation.prototype.obsHTML = function()
{
	var html = '<table cellpadding="4" border="1"><tr>';
	// SOSGetObs.fields
	// fields is an array of fld Objects
	// fld Object { name: xxx  , uom: xxx, definition: xxx }
	// any of these except name could be null
	for(var i = 0; i < this.fields.length; i++){
		var fld = this.fields[i];
		if(fld.uom){
			html += '<th>' + fld.name + ' ' + fld.uom + '</th>';
		}else{
			html += '<th>' + fld.name + '</th>';
		}
	}

	html += '</tr>';  // end header row

	// SOSGetOBs.observations is an array of obs Objects
	// obs Object { fld1: xxx  , fld2: xxx, fld3: xxx } same number as number of flds
	for(var i = 0; i < this.observations.length; i++){
		html += '<tr>';
		var obs = this.observations[i];
		for ( var name in obs){
			html += '<td>' + obs[name] + '</td>';
		}
		html += '</tr>';
	}
	html += '</table>';
	return html;
}

SOSObservation.prototype.CSV = function()
{
	var csv = '';
	// SOSGetObs.fields
	// fields is an array of fld Objects
	// fld Object { name: xxx  , uom: xxx, definition: xxx }
	// any of these except name could be null
	for(var i = 0; i < this.fields.length; i++){
		var fld = this.fields[i];
		if(fld.uom){
			csv += '"' + fld.name + ' (' + fld.uom + ')",';
		}else{
			csv += '"' + fld.name + '",';
		}
	}

	csv = csv.slice(0,-1); // remove trailing comma

	csv += "\n"; // end header row

	// SOSGetOBs.observations is an array of obsObj
	// obs Object { fld1: xxx  , fld2: xxx, fld3: xxx } same number as number of flds
	for(var i = 0; i < this.observations.length; i++){
		var obs = this.observations[i];
		var tmp = '';
		var j = 0;
		for ( var name in obs){
			// Kind of a hack. Check the correspond fld object for defined .uom  to see if quotes or not
			// Should probably make the obsObj have time: name: val: uom:
			var fld = this.fields[j];
			if(fld.uom){
				tmp += obs[name] + ',';
			}else{
				tmp += '"' + obs[name] + '",';
			}
			j++;
		}
		tmp = tmp.slice(0,-1); // remove trailing comma
		csv += tmp + "\n";
	}
	return csv;
}
