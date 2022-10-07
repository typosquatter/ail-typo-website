last_registered = 0;
url = ''
    
function fetchDomains() {
    $.getJSON('/domains/' + $('#sid').val(), function(data) {
        $('#data').empty();
        $('<tr>').append(
            $('<th>').text("PERMUTATION"),
            $('<th>').text("IP ADDRESS"),
            $('<th>').text("NAME SERVER"),
            $('<th>').text("MAIL SERVER"),
        ).appendTo('#data')

        $.each(data, function(i, item) {
            for(j in item){
                variation = item[j]['variation'] || ''
                permutation = j || ''
                ipv4 = (item[j]['A'] || [''])[0];
                ipv6 = (item[j]['AAAA'] || [''])[0];
                dns_ns = (item[j]['NS'] || [''])[0];
                dns_mx = (item[j]['MX'] || [''])[0];
                geoip = item[j]['geoip'] || '';
                
                if (item[j]['A'])
                    ipv4length = item[j]['A'].length - 1 >= 1 ? (item[j]['A'].length - 1).toString() + ' more...' : ''
                else
                    ipv4length = ''

                
                if (item[j]['AAAA'])
                    ipv6length = item[j]['AAAA'].length - 1 >= 1 ? (item[j]['AAAA'].length - 1).toString() + ' more...' : ''
                else
                    ipv6length = ''

                if (item[j]['NS'])
                    nslength = item[j]['NS'].length - 1 >= 1 ? (item[j]['NS'].length - 1).toString() + ' more...' : ''
                else
                    nslength = ''

                if (item[j]['MX'])
                    mxlength = item[j]['MX'].length - 1 >= 1 ? (item[j]['MX'].length - 1).toString() + ' more...' : ''
                else
                    mxlength = ''


                if(j == url){
                    $('<tr>').append(
                        $("<td>").text(permutation).css({"background-color": "#e9ecef", "vertical-align": "middle", "padding-left": "5px"}).append(
                            $("<button>").text('🔗').attr({onclick: 'addClipboard(\'' + permutation + '\')', id: "original-button", type: "button", class: "btn btn-light", title: "Copy this domain to clipboard"}),
                            $('<a>').attr({id: 'link', target: '_blank', href: "https://" + permutation, title: "Go to webpage"}).append(
                                $('<i>').attr({class: "fa fa-external-link", "aria-hidden": "true"})
                            ),
                            $('</br>'),
                            $('<sup>').text(variation)
                        ),
                        $("<td>").css({"background-color": "#e9ecef", "vertical-align": "middle"}).append(
                            $("<div>").append(
                                ipv4,
                                $("<span>").attr("id", "span_length").text("   " + ipv4length)
                            ),
                            $("<div>").append(
                                ipv6,
                                $("<span>").attr("id", "span_length").text("   " + ipv6length)
                            ),
                            $('<sup>').text(geoip)
                        ),
                        $("<td>").css({"background-color": "#e9ecef", "vertical-align": "middle"}).append(
                            dns_ns,
                            $("<div>").attr("id", "span_length").text(nslength)
                        ),
                        $("<td>").css({"background-color": "#e9ecef", "vertical-align": "middle"}).append(
                            dns_mx,
                            $("<div>").attr("id", "span_length").text(mxlength)
                        )
                    ).appendTo('#data')
                }
                else{
                    $('<tr>').append(
                        $("<td>").text(permutation).css({"vertical-align": "middle", "padding-left": "5px"}).append(
                            $("<button>").text('🔗').attr({onclick: 'addClipboard(\'' + permutation + '\')', type: "button", class: "btn btn-light"}),
                            $('<a>').attr({id: 'link', target: '_blank', href: "https://" + permutation}).append(
                                $('<i>').attr({class: "fa fa-external-link", "aria-hidden": "true"})
                            ),
                            $('</br>'),
                            $('<sup>').text(variation)
                        ),
                        $("<td>").css({"vertical-align": "middle"}).append(
                            $("<div>").append(
                                ipv4,
                                $("<span>").attr("id", "span_length").text("   " + ipv4length)
                            ),
                            $("<div>").append(
                                ipv6,
                                $("<span>").attr("id", "span_length").text("   " + ipv6length)
                            ),
                            $('<sup>').text(geoip)
                        ),
                        $("<td>").css({"vertical-align": "middle"}).append(
                            dns_ns,
                            $("<div>").attr("id", "span_length").text(nslength)
                        ),
                        $("<td>").css({"vertical-align": "middle"}).append(
                            dns_mx,
                            $("<div>").attr("id", "span_length").text(mxlength)
                        )
                    ).appendTo('#data')
                }
            }
            
        });
    });
}

function pollScan() {
    $.getJSON('/status/' + $('#sid').val(), function(data) {
        pourcent = Math.round((data['complete']/data['total'])*100)
        $('#status').text('Processed ' + data['complete'] + ' of ' + data['total']);
        $('#progress').text(pourcent + '%');
        $('#progress').css("width", pourcent + '%');
        if (data['remaining'] > 0) {
            setTimeout(pollScan, 3000);
        } else {
            sid = $('#sid').val()
            if (data['stopped'])
                $('#status').text('Stopped ! Identified ' + data['registered'] + ' registered.');
            else
                $('#status').text('Scanned ' + data['complete'] + ' domains. Identified ' + data['registered'] + ' registered.');
            $('#scan').text('Scan');
            $('#dropdownDownload').append(
                $('<a>').attr({class: "btn btn-primary dropdown-toggle", href: "", role: "button", id: "dropdownMenuLink", "data-toggle": "dropdown", "aria-haspopup": "true", "aria-expanded": "false"}).text("Download"),
                $('<div>').attr({class: "dropdown-menu", "aria-labelledby": "dropdownMenuLink"}).append(
                    $('<a>').attr({class: "dropdown-item", href: "/download/" + sid + "/list"}).text("List of Variations"),
                    $('<div>').attr("class", "dropdown-divider"),
                    $('<a>').attr({class: "dropdown-item", href: "/download/" + sid + "/json"}).text("Domain Identified")
                )
            )
        }
        if (last_registered < data['registered']) {
            last_registered = data['registered']
            fetchDomains();
        }
    });
}

function extractHostname(url) {
    var hostname;
    //find & remove protocol (http, ftp, etc.) and get hostname
  
    if (url.indexOf("//") > -1) {
      hostname = url.split('/')[2];
    } else {
      hostname = url.split('/')[0];
    }
  
    //find & remove port number
    hostname = hostname.split(':')[0];
    //find & remove "?"
    hostname = hostname.split('?')[0];
  
    return hostname;
  }

function extractRootDomain(url) {
    var domain = extractHostname(url),
    splitArr = domain.split('.'),
    arrLen = splitArr.length;
  
    //extracting the root domain here
    //if there is a subdomain
    if (arrLen > 2) {
      domain = splitArr[arrLen - 2] + '.' + splitArr[arrLen - 1];
      //check to see if it's using a Country Code Top Level Domain (ccTLD) (i.e. ".me.uk")
      if (splitArr[arrLen - 2].length == 2 && splitArr[arrLen - 1].length == 2) {
        //this is using a ccTLD
        domain = splitArr[arrLen - 3] + '.' + domain;
      }
    }
    return domain.toLowerCase();
}

function validDomain(domain) {
    const regex = new RegExp('^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9](?:\.[a-zA-Z]{2,})+$');
    return regex.test(domain)
}


function addClipboard(val){
    navigator.clipboard.writeText(val);
    $("#alert-clip").fadeTo(2000, 500).slideUp(500, function() {
        $("#alert-clip").slideUp(500);
    })
}

$(document).ready(function() {
    $("#alert-clip").hide();
})

algo_list = ["omission", "repetition", "changeOrder", "transposition", "replacement", "doubleReplacement", "addition", "keyboardInsertion", "missingDot", "stripDash", "vowelSwap", "addDash", "bitsquatting", "homoglyph", "commonMisspelling", "homophones", "wrongTld", "addTld", "subdomain", "singularPluralize", "changeDotDash"]


function actionScan() {
    if (!$('#url').val()) {
        $('#status').text('↖ You need to type in a domain name first');
        return
    }
    if (!validDomain($('#url').val())){
        $('#status').text('↖ Please enter a valid domain name');
        return
    }
    if ($('#url').val().split('.').length > 4){
        $('#status').text('↖ Domain is too long');
        return
    }

    if ($('#scan').text() == 'Scan') {
        last_registered = 0;
        $('#scan').text('⏱');
        $('#data').empty();
        $('#dropdownDownload').empty();
        $('#status').empty()
        $('#progress').text('0%');
        $('#progress').css("width", '0%');

        url = $('#url').val()
        // url = extractRootDomain(u)

        
        data_dict = {}
        data_dict['url'] = url
        flag = false
        if (document.getElementById("runAll").checked){
            data_dict['runAll'] = $('#runAll').val()
            flag = true
        }else{
            for( i=0; i< algo_list.length; i++){
                if (document.getElementById(algo_list[i]).checked){
                    data_dict[algo_list[i]] = $('#' + algo_list[i]).val()
                    flag = true
                }
            }
        }

        if(!flag){
            data_dict['runAll'] = $('#runAll').val()
        }

        $.post({
            url: '/typo',
            data: JSON.stringify({
                data_dict
            }),
            contentType: 'application/json',
            success: function(data) {
                $('#intro2').hide()
                $('#sid').val(data['id']);
                $('#scan').text('Stop');
                pollScan();
            },
            error: function(xhr, status, error) {
                $('#scan').text('Scan');
                $('#status').text(xhr.responseJSON['message'] || 'Something went wrong');
            },
        });
    } else {
        stop();
        $.post({
            url: '/stop/' + $('#sid').val(),
            contentType: 'application/json',
            success: function() {
                $('#scan').text('Scan');
            }
        });
    }
}

$('#scan').click(function() {
    actionScan();
});

$('#url').on('keypress',function(e) {
    if(e.which == 13) {
        actionScan();
    }
});


function runAll(){
    if (document.getElementById("runAll").checked){
        for( i=0; i< algo_list.length; i++){
            $('#' + algo_list[i]).prop('checked', true);
        }
    }else{
        for( i=0; i< algo_list.length; i++){
            $('#' + algo_list[i]).prop('checked', false);
        }
    }
};