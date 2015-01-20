from django.shortcuts import render_to_response

def home(request):
    return render_to_response('cac_tripplanner/cac_tripplanner_home.html')



