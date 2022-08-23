last_registered = 0;
url = ''
    
function fetchDomains() {
    $.getJSON('/domains/' + $('#sid').val(), function(data) {
        $('#data').empty();
        $('<tr>').html(
                '<th>PERMUTATION</th>' +
                '<th>IP ADDRESS</th>' +
                '<th>NAME SERVER</th>' +
                '<th>MAIL SERVER</th>'
            ).appendTo('#data');
        $.each(data, function(i, item) {
            for(j in item){
                variation = item['variation'] || ''
                permutation = j || ''
                ipaddr = [
                    (item[j]['A'] || [''])[0],
                    (item[j]['AAAA'] || [''])[0],
                ].filter(Boolean).join('</br>');
                dns_ns = (item[j]['NS'] || [''])[0];
                dns_mx = (item[j]['MX'] || [''])[0];
                geoip = item[j]['geoip'] || '';

                if(j == url){
                    $('<tr>').html(
                        '<td style="background-color: #e9ecef; vertical-align: middle; padding-left: 5px;">' + permutation + '  <a href="http://' + permutation + '" id="link" target="_blank">🔗</a></br><sup>' + variation + '</sup></td>' +
                        '<td style="background-color: #e9ecef; vertical-align: middle;">' + ipaddr + '</br><sup>' + geoip + '</sup></td>' +
                        '<td style="background-color: #e9ecef; vertical-align: middle;">' + dns_ns + '</td>' +
                        '<td style="background-color: #e9ecef; vertical-align: middle;">' + dns_mx + '</td>'
                    ).appendTo('#data');
                }
                else{
                    $('<tr>').html(
                        '<td style="vertical-align: middle; padding-left: 5px;">' + permutation + '  <a href="http://' + permutation + '" id="link" target="_blank">🔗</a></br><sup>' + variation + '</sup></td>' +
                        '<td style="vertical-align: middle;">' + ipaddr + '</br><sup>' + geoip + '</sup></td>' +
                        '<td style="vertical-align: middle;">' + dns_ns + '</td>' +
                        '<td style="vertical-align: middle;">' + dns_mx + '</td>'
                    ).appendTo('#data');
                }
            }
            
        });
    });
}

function pollScan() {
    $.getJSON('/status/' + $('#sid').val(), function(data) {
        pourcent = Math.round((data['complete']/data['total'])*100)
        $('#status').html('Processed ' + data['complete'] + ' of ' + data['total']);
        $('#progress').text(pourcent + '%');
        $('#progress').css("width", pourcent + '%');
        if (data['remaining'] > 0) {
            setTimeout(pollScan, 1000);
        } else {
            sid = $('#sid').val()
            $('#status').html('Scanned ' + data['complete'] + '</a> domains. Identified ' + data['registered'] + ' registered.');
            $('#scan').text('Scan');
            $('#dropdownDownload').html(
            '<a class="btn btn-primary dropdown-toggle" href="" role="button" id="dropdownMenuLink" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false">Download</a>' +   
            '<div class="dropdown-menu" aria-labelledby="dropdownMenuLink">' + 
                '<a class="dropdown-item" href="/download/' + sid + '/list">List of Variations</a>' +
                '<div class="dropdown-divider"></div>' +
                '<a class="dropdown-item" href="/download/' + sid + '/json">Result as JSON</a>' +
            '</div>'
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
    return domain;
  }

function actionScan() {
    if (!$('#url').val()) {
        $('#status').html('↖ You need to type in a domain name first');
        return
    }

    if ($('#scan').text() == 'Scan') {
        last_registered = 0;
        $('#scan').text('⏱');
        $('#data').empty();
        $('#dropdownDownload').empty();

        u = $('#url').val()
        url = extractRootDomain(u)
        
        data_dict = {}
        data_dict['url'] = url
        flag = false
        if (document.getElementById("runAll").checked){
            data_dict['runAll'] = $('#runAll').val()
            flag = true
        }else{
            if (document.getElementById("charom").checked){
                data_dict['charom'] = $('#charom').val()
                flag = true
            }if (document.getElementById("rep").checked){
                data_dict['rep'] = $('#rep').val()
                flag = true
            }if (document.getElementById("trans").checked){
                data_dict['trans'] = $('#trans').val()
                flag = true
            }if (document.getElementById("repl").checked){
                data_dict['repl'] = $('#repl').val()
                flag = true
            }if (document.getElementById("dr").checked){
                data_dict['dr'] = $('#dr').val()
                flag = true
            }if (document.getElementById("inser").checked){
                data_dict['inser'] = $('#inser').val()
                flag = true
            }if (document.getElementById("add").checked){
                data_dict['add'] = $('#add').val()
                flag = true
            }if (document.getElementById("md").checked){
                data_dict['md'] = $('#md').val()
                flag = true
            }if (document.getElementById("sd").checked){
                data_dict['sd'] = $('#sd').val()
                flag = true
            }if (document.getElementById("vs").checked){
                data_dict['vs'] = $('#vs').val()
                flag = true
            }if (document.getElementById("hyph").checked){
                data_dict['hyph'] = $('#hyph').val()
                flag = true
            }if (document.getElementById("bs").checked){
                data_dict['bs'] = $('#bs').val()
                flag = true
            }if (document.getElementById("homog").checked){
                data_dict['homog'] = $('#homog').val()
                flag = true
            }if (document.getElementById("cm").checked){
                data_dict['cm'] = $('#cm').val()
                flag = true
            }if (document.getElementById("homoph").checked){
                data_dict['homoph'] = $('#homoph').val()
                flag = true
            }if (document.getElementById("wt").checked){
                data_dict['wt'] = $('#wt').val()
                flag = true
            }if (document.getElementById("addtld").checked){
                data_dict['addtld'] = $('#addtld').val()
                flag = true
            }if (document.getElementById("sub").checked){
                data_dict['sub'] = $('#sub').val()
                flag = true
            }if (document.getElementById("sp").checked){
                data_dict['sp'] = $('#sp').val()
                flag = true
            }if (document.getElementById("cdh").checked){
                data_dict['cdh'] = $('#cdh').val()
                flag = true
            }if (document.getElementById("cho").checked){
                data_dict['cho'] = $('#cho').val()
                flag = true
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
                $('#sid').val(data['id']);
                $('#scan').text('Stop');
                pollScan();
            },
            error: function(xhr, status, error) {
                $('#scan').text('Scan');
                $('#status').html(xhr.responseJSON['message'] || 'Something went wrong');
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
        $("#charom").prop("disabled", true)
        $("#rep").prop("disabled", true)
        $("#trans").prop("disabled", true)
        $("#repl").prop("disabled", true)
        $("#dr").prop("disabled", true)
        $("#inser").prop("disabled", true)
        $("#add").prop("disabled", true)
        $("#md").prop("disabled", true)
        $("#sd").prop("disabled", true)
        $("#vs").prop("disabled", true)
        $("#hyph").prop("disabled", true)
        $("#bs").prop("disabled", true)
        $("#homog").prop("disabled", true)
        $("#cm").prop("disabled", true)
        $("#homoph").prop("disabled", true)
        $("#wt").prop("disabled", true)
        $("#addtld").prop("disabled", true)
        $("#sub").prop("disabled", true)
        $("#sp").prop("disabled", true)
        $("#cdh").prop("disabled", true)
        $("#cho").prop("disabled", true)
    }else{
        $("#charom").prop("disabled", false)
        $("#rep").prop("disabled", false)
        $("#trans").prop("disabled", false)
        $("#repl").prop("disabled", false)
        $("#dr").prop("disabled", false)
        $("#inser").prop("disabled", false)
        $("#add").prop("disabled", false)
        $("#md").prop("disabled", false)
        $("#sd").prop("disabled", false)
        $("#vs").prop("disabled", false)
        $("#hyph").prop("disabled", false)
        $("#bs").prop("disabled", false)
        $("#homog").prop("disabled", false)
        $("#cm").prop("disabled", false)
        $("#homoph").prop("disabled", false)
        $("#wt").prop("disabled", false)
        $("#addtld").prop("disabled", false)
        $("#sub").prop("disabled", false)
        $("#sp").prop("disabled", false)
        $("#cdh").prop("disabled", false)
        $("#cho").prop("disabled", false)
    }
};