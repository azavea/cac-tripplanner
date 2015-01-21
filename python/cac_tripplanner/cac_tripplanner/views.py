from django.shortcuts import render_to_response
from django.template import RequestContext

def home(request):
    print request.META['REMOTE_ADDR']
    return render_to_response('home.html', context_instance=RequestContext(request))

def map(request):
    return render_to_response('map.html', context_instance=RequestContext(request))
