last_registered = 0;
url = ''
    
function fetchDomains() {
    $.getJSON('/domains/' + $('#sid').val(), function(data) {
        $('#data').empty();
        $('<tr>').append(
            $('<th>').text("PERMUTATION").click(function(){
                var table = $(this).parents('table').eq(0)
                var rows = table.find('tr:gt(0)').toArray().sort(comparer($(this).index(), !this.asc))
                this.asc = !this.asc
                if (!this.asc){rows = rows.reverse()}
                for (var i = 0; i < rows.length; i++){table.append(rows[i])} }
            ),
            $('<th>').text("IP ADDRESS").click(function(){ 
                var table = $(this).parents('table').eq(0)
                var rows = table.find('tr:gt(0)').toArray().sort(comparer($(this).index(), !this.asc))
                this.asc = !this.asc
                if (!this.asc){rows = rows.reverse()}
                for (var i = 0; i < rows.length; i++){table.append(rows[i])} }
            ),
            $('<th>').text("NAME SERVER").click(function(){ 
                var table = $(this).parents('table').eq(0)
                var rows = table.find('tr:gt(0)').toArray().sort(comparer($(this).index(), !this.asc))
                this.asc = !this.asc
                if (!this.asc){rows = rows.reverse()}
                for (var i = 0; i < rows.length; i++){table.append(rows[i])} }
            ),
            $('<th>').text("MAIL SERVER").click(function(){ 
                var table = $(this).parents('table').eq(0)
                var rows = table.find('tr:gt(0)').toArray().sort(comparer($(this).index(), !this.asc))
                this.asc = !this.asc
                if (!this.asc){rows = rows.reverse()}
                for (var i = 0; i < rows.length; i++){table.append(rows[i])}
            }),
        ).appendTo('#data')
        $('<tr>').attr("id", "first_line").appendTo("#data")
        $('<tr>').attr("id", "bank_line").appendTo("#data")
        $('<tr>').attr("id", "university_line").appendTo("#data")
        $('<tr>').attr("id", "moz_line").appendTo("#data")
        $('<tr>').attr("id", "tranco_line").appendTo("#data")
        $('<tr>').attr("id", "majestic_line").appendTo("#data")
        $('<tr>').attr("id", "parking_line").appendTo("#data")
        
        cp_collapse = 0
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
                    $("#first_line").before($('<tr>').append(
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
                    ))
                }
                else{
                    first_td = $("<td>").css({"vertical-align": "middle", "padding-left": "5px"})
                    current_tr = $('<tr>')
                    if (item[j]["bank_domains"]){
                        first_td.append($('<b>').text("🏦 ").attr({title: "This domain is present in the list of known banking website"}))
                        $("#bank_line").after(current_tr)
                    }
                    else if(item[j]['university_domains']){
                        first_td.append($('<b>').text("📚 ").attr({title: "This domain is present in the list of university domains"}))
                        $("#university_line").after(current_tr)
                    }
                    else if (item[j]["majestic_million"]){
                        first_td.append($('<b>').text("✅ ").attr({title: "This domain is present in the top 100000 of the most visited websites"}))
                        $("#majestic_line").after(current_tr)
                    }
                    else if (item[j]["tranco"]){
                        first_td.append($('<b>').text("✔️").attr({title: "This domain is present in the top 100000 of Tranco list"}))
                        $("#tranco_line").after(current_tr)
                    }
                    else if (item[j]["moz-top500"]){
                        first_td.append($('<b>').text("🦊 ").attr({title: "This domain is present in the top 500 of moz list"}))
                        $("#moz_line").after(current_tr)
                    }
                    else if (item[j]['parking_domains']){
                        first_td.append($('<b>').text("🅿️ ").attr({title: "This domain is present in the list of parking domain"}))
                        $("#parking_line").after(current_tr)
                    }
                    else
                        $("#first_line").before(current_tr)

                    current_tr.append(
                        first_td.append(
                            permutation,
                            $("<button>").text('🔗').attr({onclick: 'addClipboard(\'' + permutation + '\')', type: "button", class: "btn btn-light", title: "Copy this domain to clipboard"}).css({"background-color": "#ffffff"}),
                            $('<a>').attr({id: 'link', target: '_blank', href: "https://" + permutation, title: "Go to webpage"}).append(
                                $('<i>').attr({class: "fa fa-external-link", "aria-hidden": "true"})
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
                            ))
                        )
                    )
                    
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
                $('#status').text('Found ' + data['complete'] + ' domains. Identified ' + data['registered'] + ' registered.');
            $('#scan').text('Search');
            $('#dropdownDownload').append(
                $('<a>').attr({class: "btn btn-primary dropdown-toggle", href: "", role: "button", id: "dropdownMenuLink", "data-toggle": "dropdown", "aria-haspopup": "true", "aria-expanded": "false"}).text("Download"),
                $('<div>').attr({class: "dropdown-menu", "aria-labelledby": "dropdownMenuLink"}).append(
                    $('<a>').attr({class: "dropdown-item", href: "/download/" + sid + "/list"}).text("List of Variations"),
                    $('<div>').attr("class", "dropdown-divider"),
                    $('<a>').attr({class: "dropdown-item", href: "/download/" + sid + "/json"}).text("Domain Identified"),
                    $('<div>').attr("class", "dropdown-divider"),
                    $('<a>').attr({class: "dropdown-item", href: "/download/" + sid + "/misp-feed"}).text("Misp Feed"),
                    $('<a>').attr({class: "dropdown-item", href: "/download/" + sid + "/misp-json"}).text("Misp Json")
                )
            )
            // $('#share_button').css({'display': '', 'float': 'right'}).attr('title', "http://localhost:7005/" + $('#sid').val())
            $('#share_button').css({'display': '', 'float': 'right'}).attr('title', "https://typosquatting-finder.circl.lu/" + $('#sid').val())
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

    if( $("#share").val() != 0){
        checkShare()
    }
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

    if ($('#scan').text() == 'Search') {
        last_registered = 0;
        $('#scan').text('⏱');
        $('#data').empty();
        $('#dropdownDownload').empty();
        $('#share_button').css({'display': 'none'})
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
                $('#scan').text('Search');
                $('#status').text(xhr.responseJSON['message'] || 'Something went wrong');
            },
        });
    } else {
        stop();
        $.post({
            url: '/stop/' + $('#sid').val(),
            contentType: 'application/json',
            success: function() {
                $('#scan').text('Search');
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

function share_button(){
    navigator.clipboard.writeText("https://typosquatting-finder.circl.lu/" + $('#sid').val());
    // navigator.clipboard.writeText("http://localhost:7005/" + $('#sid').val());
    $("#alert-clip").fadeTo(2000, 500).slideUp(500, function() {
        $("#alert-clip").slideUp(500);
    })
}

function checkShare(){
    $.get({
        url: '/share/' + $("#share").val(),
        contentType: 'application/json',
        success: function(data) {
            $('#sid').val($("#share").val());
            $('#url').val(data)
            url = data
            $('#scan').text('Stop');
            pollScan();
        },
        error: function(xhr, status, error) {
            $('#scan').text('Search');
            $('#status').text(xhr.responseJSON['message'] || 'Something went wrong');
        },
    });

}

function comparer(index, asc) {
    return function(a, b) {
        var valA = getCellValue(a, index), valB = getCellValue(b, index)
        var valColumn0A = getCellValue(a, 0), valColumn0B = getCellValue(b, 0)
        const icon = ['✅', '🅿️', '📚', '🏦', '🦊', '✔️']

        const col0_valA = icon.some(e1 => valColumn0A.includes(e1))
        const col0_valB = icon.some(e1 => valColumn0B.includes(e1))
        
        if(index == 1){
            if (!valA.trim() || col0_valA) {
                if (asc)
                    valA = '999.999'
                else
                    valA = '0.0'
            }else
                valA = valA.split(".")[0] + '.' + valA.split(".")[1]

            if (!valB.trim() || col0_valB) {
                if (asc)
                    valB = '999.999'
                else
                    valB = '0.0'
            }else
                valB = valB.split(".")[0] + '.' + valB.split(".")[1]
            
        }
        if(index == 3){
            valA = valA.split(" ")[1]
            valB = valB.split(" ")[1]
        }

        

        if (!valA || (col0_valA && index != 1) ) {
            if (asc){
                if (!valA)
                    valA = 'zzz'
                else
                    valA = 'yyy'
            }
            else{
                if (!valA)
                    valA = 'aaa'
                else
                    valA = 'aab'
            }
        }
         
        if (!valB || (col0_valB && index != 1)) {
            if (asc){
                if (!valB)
                    valB = 'zzz'
                else
                    valB = 'yyy'
            }
            else{
                if (!valB)
                    valB = 'aaa'
                else
                    valB = 'aab'
            }
        };

        return $.isNumeric(valA) && $.isNumeric(valB) ? valA - valB : valA.toString().localeCompare(valB)
    }
}
function getCellValue(row, index){ return $(row).children('td').eq(index).text() }


