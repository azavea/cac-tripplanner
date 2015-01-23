from django.http import HttpResponse


def stub_view(request):
    """Do nothing--just here for URL resolution"""
    return HttpResponse()
