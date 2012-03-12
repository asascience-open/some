///////////////////////
// Author: Eric Bridger ebridger@gmri.org  eric.bridger@gmail.com
// Date:   Feb. 2011
// Describption: Use JQuery to parse OGC Sensor Observation Service GetCapabilities response XML with both default namespace and non.
// E.g. <Capabilities> and <sos:Capabilities>
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
function SOSCapabilities(xml)
{
	this.checkSOSNS(xml);
	if(this.namespace === 'EXCEPTION' ){
		// so both GetObs and GetCap has this member for error checks
		this.type = 'EXCEPTION';
		return;
	}
	this.current_offering_idx = 0;

	this.parseGetCap(xml, this.namespace);
	this.number_of_offerings = this.offerings.length;
}

SOSCapabilities.prototype.searchOfferings = function(offering_re, fld_name)
{
	// default is offering.name
	if(! fld_name){
		fld_name = 'name';
	}

	if(offering_re){
		var re = new RegExp(offering_re, "ig");

		for(var i = 0; i < this.offerings.length; i++){
			var offer = this.offerings[i];
			if(offer[fld_name].match(re)){
				return offer;
			}
		}
	}
	return null;
}

/////////////////////////////////
// Offering Iterator
////////////////////////////////
SOSCapabilities.prototype.next = function()
{
	if(this.current_offering_idx >= this.offerings.length){
		return null;
	}
	this.current_offering_idx++;
	return(this.offerings[this.current_offering_idx - 1]);
}

SOSCapabilities.prototype.reset = function()
{
	this.current_offering_idx = 0;
}

/////////////////////////////////
// Offering object
/////////////////////////////////
// Constructor
function Offering()
{
	this.properties = [];
}

Offering.prototype.getObsUrl = function(property_re)
{
	var property = '';
	if(property_re){
		property = this.getPropertyRE(property_re);
	}else{
		property = this.getPropertyIdx(0);
	}

	var url = this.parent.sos_obs_url + '?request=GetObservation&service=SOS&version=' + this.parent.sos_version;

	// SOS responseFormat is messy, embedded " and spaces, so encode it for use as in an html link.
	url += '&responseFormat=' + encodeURIComponent(this.parent.xml_response_format);
	url += '&offering=' + this.name;
	url += '&procedure=' + this.procedure;
	// WeatherFlow SOS objects to observedProperty!
	url += '&observedproperty=' + encodeURIComponent(property);
	return url;
}

Offering.prototype.getDescribeSensorUrl = function()
{

	var url = this.parent.sos_describe_url + '?request=DescribeSensor&service=SOS&version=' + this.parent.sos_version;

	// SOS responseFormat is messy, embedded " and spaces, so encode it for use as in an html link.
	url += '&outputFormat=' + encodeURIComponent(this.parent.xml_output_format);
	url += '&procedure=' + this.procedure;
	return url;
}

Offering.prototype.getPropertyRE = function(property_re)
{

	var re = new RegExp(property_re, "i");

	for(var i = 0; i < this.properties.length; i++){
		var prop = this.properties[i];
		if(prop.match(re)){
			return prop;
		}
	}

	return null;
}

//////// 
// SOSCapabilities Constructor
/////////////
SOSCapabilities.prototype.parseGetCap = function(xml, namespace)
{
	// Note: because we rely on JQuery's $(this) operator within the find(), we cannot use this.xxx when $(this) has been called. 
	// SOSCapabilities.  So we collect in GetCap object and set this memebers at the end.
	var GetCap = new Object;
	GetCap.keywords = [];
	GetCap.offerings = [];
	GetCap.response_formats = [];
	GetCap.output_formats = [];
    GetCap.xml_response_format = '';
    GetCap.xml_output_format = '';

	// we're counting on only 1 of some of these
	GetCap.title = $(xml).filterNode('ows:Title').text();
	GetCap.svc_type = $(xml).filterNode('ows:ServiceType').text();
	GetCap.sos_version = $(xml).filterNode('ows:ServiceTypeVersion').text();
	GetCap.provider = $(xml).filterNode('ows:ProviderName').text();
	GetCap.provider_url = $(xml).filterNode('ows:ProviderSite').attr('xlink:href');
	GetCap.contact_name = $(xml).filterNode('ows:IndividualName').text();
	GetCap.contact_phone = $(xml).filterNode('ows:Voice').text();
	GetCap.contact_email = $(xml).filterNode('ows:ElectronicMailAddress').text();
	GetCap.address = $(xml).filterNode('ows:DeliveryPoint').text();
	GetCap.city = $(xml).filterNode('ows:City').text();
	GetCap.state_or_area = $(xml).filterNode('ows:AdministrativeArea').text();
	GetCap.postal_code = $(xml).filterNode('ows:PostalCode').text();
	GetCap.country = $(xml).filterNode('ows:Country').text();
	// Could be mulitple Keywords
	$(xml).filterNode('ows:Keyword').each( function() {
		var kw = $(this).text();
		GetCap.keywords.push(kw);
	});


	$(xml).filterNode('ows:Operation').each( function() {
		var op = $(this);
		// NOTE: we are skipping DescribeSensor for now
		if(op.attr('name') === 'GetObservation'){
			// Could be a Post version of this url
			var get = op.filterNode('ows:Get');
			GetCap.sos_obs_url = get.attr('xlink:href');
			// Try and get responseFormat here to save time
			// But the NDBC DIF is missing this section which is an error.
			var param = op.filterNode('responseFormat');
			param.filterNode('ows:Value').each( function() {
				var rf = $(this).text();
				GetCap.response_formats.push(rf);
			}); // end each responseFormat
		} // end if GetObservation
		if(op.attr('name') === 'DescribeSensor'){
			// Could be a Post version of this url
			var get = op.filterNode('ows:Get');
			GetCap.sos_describe_url = get.attr('xlink:href');
			// Unlike responseFormat outputFormat only appears in the Operations Section and not in the OfferingList
			// Not sure what the spec is
			var param = op.find("[name='outputFormat']");
			param.filterNode('ows:Value').each( function() {
				var rf = $(this).text();
				GetCap.output_formats.push(rf);
				if(rf.match(/^text\/xml/)){
					GetCap.xml_output_format = rf;
				}
			}); // end each outputFormat
		} // end if DescribeSensor
	});

	// NS vs. DEF_NS namespace differences (sos:ObservationOffering vs ObservationOffering)
	// so we set up find() strings for both cases
	var offeringNodeName = (namespace === 'NS') ? 'sos:ObservationOffering' : 'ObservationOffering';
	var procedureNodeName = (namespace === 'NS') ? 'sos:procedure' : 'procedure';
	var responseFormatNodeName = (namespace === 'NS') ? 'sos:responseFormat' : 'responseFormat';
	var observedPropertyNodeName = (namespace === 'NS') ? 'sos:observedProperty' : 'observedProperty';

    //  collect a list of unique responseFormats in case 
    var unique_response_formats = {};

	$(xml).filterNode(offeringNodeName).each( function() {
		var off_node = $(this);

		var OfferingObj = new Offering();

		var gml_id = off_node.attr('gml:id');
		//  HERE for now we are skipping any  "all" offerings
		if(gml_id.match(/all/i)){
			return true;
		}
		OfferingObj.gml_id = gml_id;
		var gml_name = off_node.filterNode('gml:name').text();
		// Java OOSTethys does not set gml_name
		if(!gml_name){
			gml_name = gml_id;
		}
		if(gml_name.match(/:/)){
			OfferingObj.shortName = gml_name.split(':').pop();
		}else{
			OfferingObj.shortName = gml_name;
		}
		OfferingObj.name = gml_name;
		OfferingObj.description = off_node.filterNode('gml:description').text();
		// Could there be multiple procedures?? Need to check this
		// ALL offerings can have many
		OfferingObj.procedure = off_node.filterNode(procedureNodeName).attr('xlink:href');

		// There is a problem with the NDBC DIF SOS (and the software many installed)
		// No Parameter list for responseFormat AllowedValues
		if( GetCap.response_formats.length == 0){
            // if we didn't get response formats from GetCap Operations section try and get list from OfferingList
			off_node.filterNode(responseFormatNodeName).each( function() {
				var rf = $(this).text();
                unique_response_formats[rf] = 1;
			}); // end foreach responseFormat
		} // end if response_formats.lenght == 0

		var pos = off_node.filterNode('gml:upperCorner').text().split(' ');
		OfferingObj.ulat = pos.shift();
		OfferingObj.ulon = pos.shift();
		pos = off_node.filterNode('gml:lowerCorner').text().split(' ');
		OfferingObj.llat = pos.shift();
		OfferingObj.llon = pos.shift();
		// Time positions
		OfferingObj.begin_time = '';
		OfferingObj.end_time = '';
		var time_node = off_node.filterNode('gml:beginPosition');
		OfferingObj.begin_time = time_node.text();
		if(!OfferingObj.begin_time){
			OfferingObj.begin_time = time_node.attr('indeterminatePosition');
		}
		time_node = off_node.filterNode('gml:endPosition');
		OfferingObj.end_time = time_node.text();
		if(!OfferingObj.end_time){
			OfferingObj.end_time = time_node.attr('indeterminatePosition');
		}

		off_node.filterNode(observedPropertyNodeName).each( function() {
			var prop = $(this).attr('xlink:href');
			OfferingObj.properties.push(prop);
		}); // end find each observedProperty

		GetCap.offerings.push(OfferingObj);
	}); // end foreach ObservationOffering

    // if no response_formats from the GetCap Operations section, fill it from the unique_formats gathered from OfferingList
	if( GetCap.response_formats.length == 0){
        for( var this_rf in unique_response_formats){
            GetCap.response_formats.push(this_rf);
        }
    }
    // now check  for an xml response format to use as the default href when formulating GetObs requests
	for(var i = 0; i < GetCap.response_formats.length; i++){
        var rf = GetCap.response_formats[i];
        if(rf.match(/\/xml/)){   // this get text/xml and application/xml
        	GetCap.xml_response_format = rf;
            break;
        }
    }
    // if still no xml response format just use the first in the list
    if( ! GetCap.xml_response_format){
        GetCap.xml_response_format = GetCap.response_formats[0];
    }
    // if still none it's not a GetCap XML file
    // HERE need a sanity check
    if( ! GetCap.xml_response_format){
        GetCap.xml_response_format = 'NONE_FOUND';
    }

    if (GetCap.xml_response_format.match(/ioos/i)){
		GetCap.type = 'DIF';
	}else{
		GetCap.type = 'SWE';
	}


	// Both these bookkeeping's are due to jQuery taking over $(this) keyword above.

	// save reference to GetCap parent so it can access sos_obs_url, etc. in each Offering

	for(var jj = 0; jj < GetCap.offerings.length; jj++){
		var offer = GetCap.offerings[jj];
		offer.parent = this;
	}

	// move local GetCap properites to this SOSCapabilities instance
	for(var name in GetCap){
		this[name] = GetCap[name];
	}
}

// returns 'DEF_NS' or 'NS' or 'EXCEPTION'. 
SOSCapabilities.prototype.checkSOSNS = function(xml){

	var root_node = $(xml).find("*");
	// Check for SOS ExceptionReport
	var tag = root_node.get(0).tagName;
	// Note:  ^ must begin with Exception, no namespace prefix
	if(tag.match(/^Exception/i)){
		var code = $(xml).find("Exception").attr('exceptionCode');
		var locator = $(xml).find("Exception").attr('locator');
		var error = code + ' ' + locator + ' ' + $(xml).find("ExceptionText").text();
		this.namespace = 'EXCEPTION';
		this.exception_error = error;
		return;
	}
	// OOSTethys (SWE) uses ows: namespace
	if(tag.match(/^ows\:Exception/i)){
		var code = $(xml).find("ows\\:Exception").attr('exceptionCode');
		var locator = $(xml).find("ows\\:Exception").attr('locator');
		var error = code + ' ' + locator + ' ' + $(xml).find("ows\\:ExceptionText").text();
		this.namespace = 'EXCEPTION';
		this.exception_error = error;
		return;
	}
	// no sos:Capabilities, which SWE uses, DIF does not.
	// This is very unreliable.  A check for default namespaces attr('xmlns') does not work
	// because NERACOOS uses sos:Capabilities but also has a default namespace.
	// As I get into the parsing perhaps I'll find a more significant marker.
	if(tag.match(/^Capabilities$/)){
		this.namespace = 'DEF_NS';
		this.exception_error = '';
		return;
	}else if(tag.match(/^sos:Capabilities$/)){
		this.namespace = 'NS';
    	this.exception_error = '';
    	return;
    }else{
    	// if we got here some unknown expception_error
		this.namespace = 'EXCEPTION';
		this.exception_error = 'Unknown. Not an SOS GetCapabilities XML';
        return;
    }
}

