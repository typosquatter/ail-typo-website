last_registered = 0;
url = ''
    
function fetchDomains() {
    $.getJSON('/domains/' + $('#sid').val(), function(data) {
        $('#data').empty();
        $('<tr>').append(
            $('<th>').text("PERMUTATION").click(function(){ sort_table(0) }),
            $('<th>').text("IP ADDRESS").click(function(){ sort_table(1) }),
            $('<th>').text("NAME SERVER").click(function(){ sort_table(2) }),
            $('<th>').text("MAIL SERVER").click(function(){ sort_table(3) }),
        ).appendTo('#data')
        $('<tr>').attr("id", "last_line").appendTo("#data")

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
                    $("#last_line").before($('<tr>').append(
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
                    if (item[j]["majestic_million"]){
                        $("#last_line").after($('<tr>').append(
                            $("<td>").css({"vertical-align": "middle", "padding-left": "5px"}).append(
                                $('<b>').text("✅ ").attr({title: "This domain is present in the top 100000 of the most visited websites"}),
                                permutation,
                                $("<button>").text('🔗').attr({onclick: 'addClipboard(\'' + permutation + '\')', type: "button", class: "btn btn-light", title: "Copy this domain to clipboard"}).css({"background-color": "#ffffff"}),
                                $('<a>').attr({id: 'link', target: '_blank', href: "https://" + permutation, title: "Go to webpage"}).append(
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
                            ))
                        )
                    }else{
                        $("#last_line").before($('<tr>').append(
                            $("<td>").text(permutation).css({"vertical-align": "middle", "padding-left": "5px"}).append(
                                $("<button>").text('🔗').attr({onclick: 'addClipboard(\'' + permutation + '\')', type: "button", class: "btn btn-light", title: "Copy this domain to clipboard"}).css({"background-color": "#ffffff"}),
                                $('<a>').attr({id: 'link', target: '_blank', href: "https://" + permutation, title: "Go to webpage"}).append(
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
                        ))
                    }
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



function sort_table(column){
    var table, rows, switching, i, x, y, shouldSwitch, dir, switchcount = 0;
    table = document.getElementById("data");
    switching = true;
    //Set the sorting direction to ascending:
    dir = "asc"; 
    /*Make a loop that will continue until
    no switching has been done:*/
    while (switching) {
      //start by saying: no switching is done:
      switching = false;
      rows = table.rows;
      /*Loop through all table rows (except the
      first, which contains table headers):*/
      for (i = 1; i < (rows.length - 1); i++) {
        if( i + 1< (rows.length - 1)){
            //start by saying there should be no switching:
            shouldSwitch = false;
            /*Get the two elements you want to compare,
            one from current row and one from the next:*/
            x = rows[i].getElementsByTagName("TD")[column];
            y = rows[i + 1].getElementsByTagName("TD")[column];

            if(column==1){
                x_split = x.innerHTML.toLowerCase().split(".")[0]
                y_split = y.innerHTML.toLowerCase().split(".")[0]
            }
            if(column == 3){
                x_split = x.innerHTML.toLowerCase().split(" ")[1]
                y_split = y.innerHTML.toLowerCase().split(" ")[1]
            }
            if(column == 3 || column == 1){
                if (dir == "asc") {
                    if (x_split > y_split) {
                        //if so, mark as a switch and break the loop:
                        shouldSwitch= true;
                        break;
                    }
                } else if (dir == "desc") {
                    if (x_split < y_split) {
                        //if so, mark as a switch and break the loop:
                        shouldSwitch = true;
                        break;
                    }
                }
            }
            else{
                if (dir == "asc") {
                    if (x.innerHTML.toLowerCase() > y.innerHTML.toLowerCase()) {
                        //if so, mark as a switch and break the loop:
                        shouldSwitch= true;
                        break;
                    }
                } else if (dir == "desc") {
                    if (x.innerHTML.toLowerCase() < y.innerHTML.toLowerCase()) {
                        //if so, mark as a switch and break the loop:
                        shouldSwitch = true;
                        break;
                    }
                }
            }
        }
      }
      if (shouldSwitch) {
        /*If a switch has been marked, make the switch
        and mark that a switch has been done:*/
        rows[i].parentNode.insertBefore(rows[i + 1], rows[i]);
        switching = true;
        //Each time a switch is done, increase this count by 1:
        switchcount ++;      
      } else {
        /*If no switching has been done AND the direction is "asc",
        set the direction to "desc" and run the while loop again.*/
        if (switchcount == 0 && dir == "asc") {
          dir = "desc";
          switching = true;
        }
      }
    }
}