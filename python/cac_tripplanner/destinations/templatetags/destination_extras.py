from django import template

register = template.Library()

@register.simple_tag(name='has_activity')
def has_activity(destination, activity_name):
    """Test if a given activity is available at the passed destination"""
    return destination.has_activity(activity_name) if destination else False
