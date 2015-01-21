from django.shortcuts import render_to_response
from django.template import RequestContext
from django.conf import settings

def home(request):
    return render_to_response('home.html', dict(debug=settings.DEBUG))

def map(request):
    return render_to_response('map.html', dict(debug=settings.DEBUG))
